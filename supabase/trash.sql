-- ========== 휴지통 (7일 보관 후 영구 삭제) ==========
alter table public.works    add column if not exists deleted_at timestamptz,
                            add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
                            add column if not exists deleted_why text;   -- null = 일반 삭제, 그 외 = 제재 사유
alter table public.episodes add column if not exists deleted_at timestamptz,
                            add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
                            add column if not exists deleted_why text;

-- 휴지통에 있는 회차와 번호가 겹쳐도 새 회차를 올릴 수 있게
alter table public.episodes drop constraint if exists episodes_work_id_no_key;
create unique index if not exists episodes_alive_no on public.episodes(work_id, no) where deleted_at is null;

create or replace function public.work_alive(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from works where id = p_id and deleted_at is null);
$$;

-- 휴지통에 있는 것은 아무에게도 일반 목록으로 보이지 않음 (휴지통 함수로만 조회)
drop policy if exists w_sel on public.works;
create policy w_sel on public.works for select using (
  deleted_at is null and (status = 'approved' or author_id = auth.uid() or is_admin()));
drop policy if exists e_sel on public.episodes;
create policy e_sel on public.episodes for select using (
  deleted_at is null and work_alive(work_id) and (status = 'approved' or author_id = auth.uid() or is_admin()));
-- 바로 지우는 건 막고, 휴지통 함수로만
drop policy if exists w_del on public.works;
drop policy if exists e_del on public.episodes;

create or replace function public.trash_days() returns int language sql immutable as $$ select 7 $$;

-- 휴지통으로 옮기기
create or replace function public.trash_item(p_kind text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_title text;
begin
  if p_kind = 'work' then
    select author_id, title into v_user, v_title from works where id = p_id and deleted_at is null;
  elsif p_kind = 'episode' then
    select e.author_id, w.title || ' · ' || e.title into v_user, v_title
      from episodes e join works w on w.id = e.work_id where e.id = p_id and e.deleted_at is null;
  else raise exception '알 수 없는 항목이에요'; end if;
  if v_user is null then raise exception '이미 삭제됐거나 찾을 수 없어요'; end if;
  if v_user <> auth.uid() and not is_admin() then raise exception '내 작품만 삭제할 수 있어요'; end if;
  perform set_config('app.bypass', 'on', true);
  if p_kind = 'work' then
    update works set deleted_at = now(), deleted_by = auth.uid(), deleted_why = null where id = p_id;
  else
    update episodes set deleted_at = now(), deleted_by = auth.uid(), deleted_why = null where id = p_id;
  end if;
  perform set_config('app.bypass', 'off', true);
  if v_user <> auth.uid() then
    insert into notices (user_id, kind, title, message, target) values
      (v_user, 'reject', '운영자가 ' || case when p_kind = 'work' then '작품' else '회차' end || '을 휴지통으로 옮겼어요',
       trash_days() || '일 안에 MY › 휴지통에서 되살릴 수 있어요.', '「' || v_title || '」');
  end if;
end $$;

-- 휴지통 목록 (작가는 자기 것, 운영자는 전체)
create or replace function public.trash_list()
returns table (kind text, id bigint, work_id bigint, title text, work_title text, thumb_path text,
  author_id uuid, author_name text, deleted_at timestamptz, deleted_by_name text, deleted_why text,
  expires_at timestamptz, ep_count int, can_restore boolean)
language sql stable security definer set search_path = public as $$
  select 'work', w.id, w.id, w.title, w.title, w.thumb_path, w.author_id,
         coalesce(p.pen_name, p.display_name), w.deleted_at, d.display_name, w.deleted_why,
         w.deleted_at + make_interval(days => trash_days()),
         (select count(*)::int from episodes e where e.work_id = w.id and e.deleted_at is null),
         (is_admin() or w.deleted_why is null)
    from works w join profiles p on p.id = w.author_id left join profiles d on d.id = w.deleted_by
   where w.deleted_at is not null and (is_admin() or (w.author_id = auth.uid() and w.deleted_why is null))
  union all
  select 'episode', e.id, e.work_id, e.title, w.title, e.thumb_path, e.author_id,
         coalesce(p.pen_name, p.display_name), e.deleted_at, d.display_name, e.deleted_why,
         e.deleted_at + make_interval(days => trash_days()), 0,
         (is_admin() or e.deleted_why is null)
    from episodes e join works w on w.id = e.work_id join profiles p on p.id = e.author_id
    left join profiles d on d.id = e.deleted_by
   where e.deleted_at is not null and (is_admin() or (e.author_id = auth.uid() and e.deleted_why is null))
  order by 9 desc;
$$;

-- 되살리기
create or replace function public.restore_item(p_kind text, p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_why text; v_work bigint; v_no int; v_new int;
begin
  if p_kind = 'work' then
    select author_id, deleted_why into v_user, v_why from works where id = p_id and deleted_at is not null;
  elsif p_kind = 'episode' then
    select author_id, deleted_why, work_id, no into v_user, v_why, v_work, v_no
      from episodes where id = p_id and deleted_at is not null;
  else raise exception '알 수 없는 항목이에요'; end if;
  if v_user is null then raise exception '휴지통에서 찾을 수 없어요'; end if;
  if not is_admin() and (v_user <> auth.uid() or v_why is not null) then
    raise exception '되살릴 권한이 없어요';
  end if;
  perform set_config('app.bypass', 'on', true);
  if p_kind = 'work' then
    update works set deleted_at = null, deleted_by = null, deleted_why = null where id = p_id;
  else
    if not work_alive(v_work) then
      perform set_config('app.bypass', 'off', true);
      raise exception '작품이 휴지통에 있어요. 작품부터 되살려 주세요';
    end if;
    v_new := v_no;
    if exists (select 1 from episodes where work_id = v_work and no = v_no and deleted_at is null) then
      select coalesce(max(no), 0) + 1 into v_new from episodes where work_id = v_work and deleted_at is null;
    end if;
    update episodes set deleted_at = null, deleted_by = null, deleted_why = null, no = v_new where id = p_id;
  end if;
  perform set_config('app.bypass', 'off', true);
  if v_user <> auth.uid() then
    insert into notices (user_id, kind, title, message) values
      (v_user, 'approve', '운영자가 ' || case when p_kind = 'work' then '작품' else '회차' end || '을 되살렸어요', null);
  end if;
  return case when p_kind = 'episode' and v_new <> v_no then v_new || '화로 되살렸어요 (같은 번호가 이미 있어서)' else null end;
end $$;

-- 영구 삭제 공통: 지울 이미지 경로를 돌려줌 (파일은 사이트가 지움)
create or replace function public.purge_paths(p_kind text, p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p) filter (where p is not null), '{}') from (
    select w.thumb_path as p from works w where p_kind = 'work' and w.id = p_id
    union all select regexp_replace(w.thumb_path, '\.(webp|jpg)$', '_og.jpg') from works w where p_kind = 'work' and w.id = p_id
    union all select unnest(e.pages) from episodes e where (p_kind = 'work' and e.work_id = p_id) or (p_kind = 'episode' and e.id = p_id)
    union all select e.thumb_path from episodes e where (p_kind = 'work' and e.work_id = p_id) or (p_kind = 'episode' and e.id = p_id)
  ) s;
$$;

-- 지금 바로 영구 삭제 (휴지통에서)
create or replace function public.purge_item(p_kind text, p_id bigint) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_why text; v_paths text[];
begin
  if p_kind = 'work' then select author_id, deleted_why into v_user, v_why from works where id = p_id and deleted_at is not null;
  elsif p_kind = 'episode' then select author_id, deleted_why into v_user, v_why from episodes where id = p_id and deleted_at is not null;
  else raise exception '알 수 없는 항목이에요'; end if;
  if v_user is null then raise exception '휴지통에서 찾을 수 없어요'; end if;
  if not is_admin() and (v_user <> auth.uid() or v_why is not null) then raise exception '권한이 없어요'; end if;
  v_paths := purge_paths(p_kind, p_id);
  if p_kind = 'work' then delete from works where id = p_id; else delete from episodes where id = p_id; end if;
  return v_paths;
end $$;

-- 보관 기간이 지난 것 정리 (작가는 자기 것, 운영자는 전체). 지울 파일 경로를 돌려줌
create or replace function public.purge_expired() returns text[]
language plpgsql security definer set search_path = public as $$
declare r record; v_all text[] := '{}';
begin
  if auth.uid() is null then return v_all; end if;
  for r in
    select 'work' k, id from works where deleted_at < now() - make_interval(days => trash_days())
      and (is_admin() or author_id = auth.uid())
    union all
    select 'episode', id from episodes where deleted_at < now() - make_interval(days => trash_days())
      and (is_admin() or author_id = auth.uid())
  loop
    if r.k = 'episode' and not exists (select 1 from episodes where id = r.id) then continue; end if;
    v_all := v_all || purge_paths(r.k, r.id);
    if r.k = 'work' then delete from works where id = r.id; else delete from episodes where id = r.id; end if;
  end loop;
  return v_all;
end $$;

grant execute on function public.trash_item(text, bigint), public.trash_list(), public.restore_item(text, bigint),
  public.purge_item(text, bigint), public.purge_expired() to authenticated;
revoke execute on function public.purge_paths(text, bigint) from public, anon, authenticated;

-- 제재로 삭제할 때도 바로 지우지 않고 휴지통으로 (작가는 못 되살리고, 운영자만 되살릴 수 있음)
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
      perform set_config('app.bypass', 'on', true);
      update works set deleted_at = now(), deleted_by = auth.uid(), deleted_why = p_reason where id = p_id;
      perform set_config('app.bypass', 'off', true);
      v_paths := '{}';
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
      perform set_config('app.bypass', 'on', true);
      update episodes set deleted_at = now(), deleted_by = auth.uid(), deleted_why = p_reason where id = p_id;
      perform set_config('app.bypass', 'off', true);
      v_paths := '{}';
      perform apply_sanction(v_user, p_level, p_reason, p_days, '「' || v_name || '」 (삭제됨)');
    end if;
  else
    raise exception '알 수 없는 항목이에요';
  end if;
  return v_paths;
end $$;

notify pgrst, 'reload schema';
