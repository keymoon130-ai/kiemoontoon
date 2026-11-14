-- 닉네임(display_name)과 작가명(pen_name) 분리, 작가 신청 실명
alter table public.profiles add column if not exists pen_name text check (pen_name is null or char_length(pen_name) between 1 and 20);
alter table public.author_applications add column if not exists real_name text check (real_name is null or char_length(real_name) between 2 and 20);
-- 기존 작가·운영자: 지금 이름을 작가명으로 그대로 (기존 계정은 정리하지 않음)
update public.profiles set pen_name = display_name where role in ('author','admin') and pen_name is null;

-- 작가명은 작가만 바꿀 수 있게
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() or is_admin() then return new; end if;
  new.id := old.id; new.username := old.username; new.role := old.role;
  new.warnings := old.warnings; new.banned_until := old.banned_until;
  new.perma_ban := old.perma_ban; new.created_at := old.created_at;
  if old.role not in ('author','admin') then new.pen_name := old.pen_name; end if;
  return new;
end $$;

-- 새 작가 신청은 실명 필수
drop policy if exists a_ins on public.author_applications;
create policy a_ins on public.author_applications for insert with check (
  user_id = auth.uid() and status = 'pending' and can_act()
  and real_name is not null and char_length(trim(real_name)) >= 2
  and (select role from profiles where id = auth.uid()) = 'reader');

-- 승인하면 닉네임은 그대로, 작가명만 설정
create or replace function public.admin_review(p_kind text, p_id bigint, p_approve boolean,
  p_reason text default '', p_level int default 0, p_days int default 7)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_name text; v_work bigint; v_paths text[] := '{}';
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then raise exception '거절 사유를 적어 주세요'; end if;

  if p_kind = 'application' then
    select user_id, pen_name into v_user, v_name from author_applications where id = p_id and status = 'pending';
    if v_user is null then raise exception '이미 처리된 신청이에요'; end if;
    if p_approve then
      update author_applications set status = 'approved', reviewed_at = now() where id = p_id;
      update profiles set role = case when role = 'admin' then 'admin' else 'author' end, pen_name = v_name where id = v_user;
      insert into notices (user_id, kind, title, message) values
        (v_user, 'approve', '작가 신청이 승인됐어요', '이제 ' || v_name || ' 작가로 연재할 수 있어요!');
    else
      update author_applications set status = 'rejected', reason = p_reason, reviewed_at = now() where id = p_id;
      if p_level = 0 then
        insert into notices (user_id, kind, title, message, level, target) values
          (v_user, 'reject', '작가 신청이 반려됐어요', p_reason, 0, '작가 신청');
      else
        perform apply_sanction(v_user, p_level, p_reason, p_days, '작가 신청');
      end if;
    end if;

  elsif p_kind = 'work' then
    select author_id, title into v_user, v_name from works where id = p_id;
    if v_user is null then raise exception '작품을 찾을 수 없어요'; end if;
    if p_approve then
      update works set status = 'approved', reject_reason = null where id = p_id;
      insert into notices (user_id, kind, title, message) values
        (v_user, 'approve', '작품이 승인됐어요', '「' || v_name || '」이(가) 공개됐어요. 이제 회차를 올릴 수 있어요!');
    elsif p_level = 0 then
      update works set status = 'rejected', reject_reason = p_reason where id = p_id;
      insert into notices (user_id, kind, title, message, level, target) values
        (v_user, 'reject', '작품이 반려됐어요', p_reason, 0, '작품 「' || v_name || '」');
    else
      select coalesce(array_agg(p), '{}') into v_paths from (
        select thumb_path as p from works where id = p_id and thumb_path is not null
        union all select unnest(pages) from episodes where work_id = p_id
        union all select thumb_path from episodes where work_id = p_id and thumb_path is not null) s;
      delete from works where id = p_id;
      perform apply_sanction(v_user, p_level, p_reason, p_days, '작품 「' || v_name || '」 (삭제됨)');
    end if;

  elsif p_kind = 'episode' then
    select e.author_id, w.title || ' ' || e.no || '화', e.work_id into v_user, v_name, v_work
      from episodes e join works w on w.id = e.work_id where e.id = p_id;
    if v_user is null then raise exception '회차를 찾을 수 없어요'; end if;
    if p_approve then
      update episodes set status = 'approved', reject_reason = null, published_at = now() where id = p_id;
      update works set last_episode_at = now() where id = v_work;
      insert into notices (user_id, kind, title, message) values
        (v_user, 'approve', '회차가 승인됐어요', '「' || v_name || '」이(가) 공개됐어요!');
    elsif p_level = 0 then
      update episodes set status = 'rejected', reject_reason = p_reason where id = p_id;
      insert into notices (user_id, kind, title, message, level, target) values
        (v_user, 'reject', '회차가 반려됐어요', p_reason, 0, '「' || v_name || '」');
    else
      select coalesce(array_agg(p), '{}') into v_paths from (
        select unnest(pages) as p from episodes where id = p_id
        union all select thumb_path from episodes where id = p_id and thumb_path is not null) s;
      delete from episodes where id = p_id;
      perform apply_sanction(v_user, p_level, p_reason, p_days, '「' || v_name || '」 (삭제됨)');
    end if;
  else
    raise exception '알 수 없는 항목이에요';
  end if;
  return v_paths;
end $$;

-- 운영자가 작가로 직접 지정할 때 작가명이 비어 있으면 닉네임으로
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if p_role not in ('reader','author') then raise exception '등급이 올바르지 않아요'; end if;
  update profiles set role = p_role, pen_name = case when p_role='author' then coalesce(pen_name, display_name) else pen_name end where id = p_user and role <> 'admin';
  insert into notices (user_id, kind, title, message) values (p_user, 'role',
    case when p_role = 'author' then '작가 자격이 부여됐어요' else '작가 자격이 해제됐어요' end, '운영자가 등급을 변경했어요.');
end $$;
notify pgrst, 'reload schema';
