-- =====================================================================
-- 최기문웹툰 Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
-- 다시 실행해도 괜찮도록 만들어져 있어요.
-- 운영자 아이디: kiemoon (이 아이디로 가입한 계정이 자동으로 운영자가 돼요)
-- =====================================================================

-- ---------- 테이블 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text not null default '',
  role text not null default 'reader' check (role in ('reader','author','admin')),
  warnings int not null default 0,
  banned_until timestamptz,
  perma_ban boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.author_applications (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pen_name text not null check (char_length(pen_name) between 1 and 20),
  intro text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists one_pending_application on public.author_applications(user_id) where status = 'pending';

create table if not exists public.works (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  description text not null default '',
  genre text not null default '일상',
  days text[] not null default '{}',
  thumb_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  finished boolean not null default false,
  views int not null default 0,
  rating_sum int not null default 0,
  rating_count int not null default 0,
  fav_count int not null default 0,
  last_episode_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  no int not null,
  title text not null check (char_length(title) between 1 and 40),
  author_note text not null default '',
  pages text[] not null,
  thumb_path text,
  draw_seconds int not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  views int not null default 0,
  rating_sum int not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (work_id, no)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  episode_id bigint not null references public.episodes(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  like_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comment_likes (
  comment_id bigint not null references public.comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);

create table if not exists public.ratings (
  episode_id bigint not null references public.episodes(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  primary key (episode_id, user_id)
);

create table if not exists public.favorites (
  work_id bigint not null references public.works(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);

create table if not exists public.notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,              -- approve / reject / sanction / clear / role
  title text not null,
  message text not null default '',
  level int,
  until timestamptz,
  target text,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 권한 확인 함수 ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_act() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
    and not perma_ban and (banned_until is null or banned_until < now()));
$$;

create or replace function public.can_post() returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_act() and exists (select 1 from profiles where id = auth.uid() and role in ('author','admin'));
$$;

create or replace function public.bypassing() returns boolean
language sql stable as $$ select coalesce(current_setting('app.bypass', true), '') = 'on'; $$;

-- ---------- 가입하면 프로필 자동 생성 ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text := lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))));
begin
  insert into profiles (id, username, display_name, role)
  values (new.id, v_name, v_name, case when v_name = 'kiemoon' then 'admin' else 'reader' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 보호 트리거 (일반 사용자가 등급·상태·통계를 못 바꾸게) ----------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() or is_admin() then return new; end if;
  new.id := old.id; new.username := old.username; new.role := old.role;
  new.warnings := old.warnings; new.banned_until := old.banned_until;
  new.perma_ban := old.perma_ban; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.works_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.views := 0; new.rating_sum := 0; new.rating_count := 0;
    new.fav_count := 0; new.last_episode_at := null; new.created_at := now(); new.reject_reason := null;
    new.status := case when is_admin() then 'approved' else 'pending' end;
    return new;
  end if;
  if is_admin() then return new; end if;
  new.id := old.id; new.author_id := old.author_id; new.views := old.views; new.rating_sum := old.rating_sum;
  new.rating_count := old.rating_count; new.fav_count := old.fav_count;
  new.last_episode_at := old.last_episode_at; new.created_at := old.created_at;
  if old.status = 'rejected' then
    new.status := 'pending'; new.reject_reason := null;            -- 반려된 작품을 고치면 다시 승인 요청
  else
    new.status := old.status; new.reject_reason := old.reject_reason;
    new.title := old.title; new.description := old.description;    -- 승인/대기 중엔 연재요일·완결만 변경 가능
    new.genre := old.genre; new.thumb_path := old.thumb_path;
  end if;
  return new;
end $$;
drop trigger if exists works_guard on public.works;
create trigger works_guard before insert or update on public.works
  for each row execute function public.works_guard();

create or replace function public.episodes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.views := 0; new.rating_sum := 0; new.rating_count := 0;
    new.created_at := now(); new.reject_reason := null;
    if is_admin() then
      new.status := 'approved'; new.published_at := now();
      perform set_config('app.bypass', 'on', true);
      update works set last_episode_at = now() where id = new.work_id;
      perform set_config('app.bypass', 'off', true);
      return new;
    end if;
    new.status := 'pending'; new.published_at := null;
  else
    if is_admin() then return new; end if;
    if old.status <> 'rejected' then
      raise exception '승인 대기 중이거나 승인된 회차는 수정할 수 없어요';
    end if;
    new.id := old.id; new.work_id := old.work_id; new.author_id := old.author_id; new.no := old.no;
    new.views := old.views; new.rating_sum := old.rating_sum; new.rating_count := old.rating_count;
    new.created_at := old.created_at; new.published_at := null;
    new.status := 'pending'; new.reject_reason := null;
  end if;
  if coalesce(array_length(new.pages, 1), 0) < 8 then
    raise exception '한 회차는 최소 8컷 이상이어야 해요';
  end if;
  if new.draw_seconds < 300 then
    raise exception '작업 시간이 5분 이상이어야 해요';
  end if;
  return new;
end $$;
drop trigger if exists episodes_guard on public.episodes;
create trigger episodes_guard before insert or update on public.episodes
  for each row execute function public.episodes_guard();

-- ---------- 통계 자동 계산 ----------
create or replace function public.ratings_stats() returns trigger
language plpgsql security definer set search_path = public as $$
declare d_sum int := 0; d_cnt int := 0; v_ep bigint;
begin
  if tg_op = 'INSERT' then d_sum := new.score; d_cnt := 1; v_ep := new.episode_id;
  elsif tg_op = 'UPDATE' then d_sum := new.score - old.score; v_ep := new.episode_id;
  else d_sum := -old.score; d_cnt := -1; v_ep := old.episode_id; end if;
  perform set_config('app.bypass', 'on', true);
  update episodes set rating_sum = rating_sum + d_sum, rating_count = rating_count + d_cnt where id = v_ep;
  update works set rating_sum = rating_sum + d_sum, rating_count = rating_count + d_cnt
    where id = (select work_id from episodes where id = v_ep);
  perform set_config('app.bypass', 'off', true);
  return null;
end $$;
drop trigger if exists ratings_stats on public.ratings;
create trigger ratings_stats after insert or update or delete on public.ratings
  for each row execute function public.ratings_stats();

create or replace function public.favorites_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass', 'on', true);
  if tg_op = 'INSERT' then update works set fav_count = fav_count + 1 where id = new.work_id;
  else update works set fav_count = greatest(fav_count - 1, 0) where id = old.work_id; end if;
  perform set_config('app.bypass', 'off', true);
  return null;
end $$;
drop trigger if exists favorites_stats on public.favorites;
create trigger favorites_stats after insert or delete on public.favorites
  for each row execute function public.favorites_stats();

create or replace function public.likes_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update comments set like_count = like_count + 1 where id = new.comment_id;
  else update comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id; end if;
  return null;
end $$;
drop trigger if exists likes_stats on public.comment_likes;
create trigger likes_stats after insert or delete on public.comment_likes
  for each row execute function public.likes_stats();

create or replace function public.increment_view(p_episode bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_work bigint;
begin
  perform set_config('app.bypass', 'on', true);
  update episodes set views = views + 1 where id = p_episode and status = 'approved' returning work_id into v_work;
  if v_work is not null then update works set views = views + 1 where id = v_work; end if;
  perform set_config('app.bypass', 'off', true);
end $$;

create or replace function public.mark_notices_seen() returns void
language sql security definer set search_path = public as $$
  update notices set seen = true where user_id = auth.uid() and not seen;
$$;

-- ---------- 운영자 기능 ----------
-- 징계 단계: 0 반려만 / 1 경고 / 2 작가 자격 박탈 / 3 기간 정지 / 4 영구 정지
create or replace function public.apply_sanction(p_user uuid, p_level int, p_reason text, p_days int, p_target text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_until timestamptz; v_title text;
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select role into v_role from profiles where id = p_user;
  if v_role is null then raise exception '회원을 찾을 수 없어요'; end if;
  if v_role = 'admin' then raise exception '운영자는 징계할 수 없어요'; end if;
  if p_level = 1 then
    update profiles set warnings = warnings + 1 where id = p_user; v_title := '경고를 받았어요';
  elsif p_level = 2 then
    update profiles set role = 'reader' where id = p_user; v_title := '작가 자격이 박탈됐어요';
  elsif p_level = 3 then
    v_until := now() + make_interval(days => greatest(coalesce(p_days, 1), 1));
    update profiles set banned_until = v_until where id = p_user; v_title := '이용이 정지됐어요';
  elsif p_level = 4 then
    update profiles set perma_ban = true where id = p_user; v_title := '영구 정지됐어요';
  else
    raise exception '징계 단계가 올바르지 않아요';
  end if;
  insert into notices (user_id, kind, title, message, level, until, target)
  values (p_user, 'sanction', v_title, p_reason, p_level, v_until, p_target);
end $$;

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
      update profiles set role = case when role = 'admin' then 'admin' else 'author' end, display_name = v_name where id = v_user;
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

create or replace function public.admin_sanction(p_user uuid, p_level int, p_reason text, p_days int default 7)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception '징계 사유를 적어 주세요'; end if;
  perform apply_sanction(p_user, p_level, p_reason, p_days, '운영자 직접 징계');
end $$;

create or replace function public.admin_clear(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  update profiles set warnings = 0, banned_until = null, perma_ban = false where id = p_user and role <> 'admin';
  insert into notices (user_id, kind, title, message) values (p_user, 'clear', '징계가 해제됐어요', '다시 정상적으로 이용할 수 있어요.');
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  if p_role not in ('reader','author') then raise exception '등급이 올바르지 않아요'; end if;
  update profiles set role = p_role where id = p_user and role <> 'admin';
  insert into notices (user_id, kind, title, message) values (p_user, 'role',
    case when p_role = 'author' then '작가 자격이 부여됐어요' else '작가 자격이 해제됐어요' end, '운영자가 등급을 변경했어요.');
end $$;

-- ---------- 접근 규칙 (RLS) ----------
alter table public.profiles enable row level security;
alter table public.author_applications enable row level security;
alter table public.works enable row level security;
alter table public.episodes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.notices enable row level security;

drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select using (true);
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update using (id = auth.uid() or is_admin());

drop policy if exists a_sel on public.author_applications;
create policy a_sel on public.author_applications for select using (user_id = auth.uid() or is_admin());
drop policy if exists a_ins on public.author_applications;
create policy a_ins on public.author_applications for insert with check (
  user_id = auth.uid() and status = 'pending' and can_act()
  and (select role from profiles where id = auth.uid()) = 'reader');

drop policy if exists w_sel on public.works;
create policy w_sel on public.works for select using (status = 'approved' or author_id = auth.uid() or is_admin());
drop policy if exists w_ins on public.works;
create policy w_ins on public.works for insert with check (author_id = auth.uid() and can_post());
drop policy if exists w_upd on public.works;
create policy w_upd on public.works for update using ((author_id = auth.uid() and can_act()) or is_admin());
drop policy if exists w_del on public.works;
create policy w_del on public.works for delete using (author_id = auth.uid() or is_admin());

drop policy if exists e_sel on public.episodes;
create policy e_sel on public.episodes for select using (status = 'approved' or author_id = auth.uid() or is_admin());
drop policy if exists e_ins on public.episodes;
create policy e_ins on public.episodes for insert with check (
  author_id = auth.uid() and can_post()
  and exists (select 1 from works w where w.id = work_id and w.author_id = auth.uid() and w.status = 'approved'));
drop policy if exists e_upd on public.episodes;
create policy e_upd on public.episodes for update using ((author_id = auth.uid() and can_post()) or is_admin());
drop policy if exists e_del on public.episodes;
create policy e_del on public.episodes for delete using (author_id = auth.uid() or is_admin());

drop policy if exists c_sel on public.comments;
create policy c_sel on public.comments for select using (true);
drop policy if exists c_ins on public.comments;
create policy c_ins on public.comments for insert with check (user_id = auth.uid() and can_act());
drop policy if exists c_del on public.comments;
create policy c_del on public.comments for delete using (user_id = auth.uid() or is_admin());

drop policy if exists l_sel on public.comment_likes;
create policy l_sel on public.comment_likes for select using (true);
drop policy if exists l_ins on public.comment_likes;
create policy l_ins on public.comment_likes for insert with check (user_id = auth.uid() and can_act());
drop policy if exists l_del on public.comment_likes;
create policy l_del on public.comment_likes for delete using (user_id = auth.uid());

drop policy if exists r_sel on public.ratings;
create policy r_sel on public.ratings for select using (true);
drop policy if exists r_ins on public.ratings;
create policy r_ins on public.ratings for insert with check (user_id = auth.uid() and can_act());
drop policy if exists r_upd on public.ratings;
create policy r_upd on public.ratings for update using (user_id = auth.uid() and can_act());

drop policy if exists f_sel on public.favorites;
create policy f_sel on public.favorites for select using (user_id = auth.uid());
drop policy if exists f_ins on public.favorites;
create policy f_ins on public.favorites for insert with check (user_id = auth.uid());
drop policy if exists f_del on public.favorites;
create policy f_del on public.favorites for delete using (user_id = auth.uid());

drop policy if exists n_sel on public.notices;
create policy n_sel on public.notices for select using (user_id = auth.uid() or is_admin());

-- ---------- 사용 권한 ----------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- ---------- 이미지 저장 공간 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toon', 'toon', true, 5242880, array['image/webp','image/png','image/jpeg'])
on conflict (id) do nothing;

drop policy if exists toon_read on storage.objects;
create policy toon_read on storage.objects for select using (bucket_id = 'toon');
drop policy if exists toon_upload on storage.objects;
create policy toon_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'toon' and (storage.foldername(name))[1] = auth.uid()::text and public.can_post());
drop policy if exists toon_delete on storage.objects;
create policy toon_delete on storage.objects for delete to authenticated using (
  bucket_id = 'toon' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 끝! 이제 사이트에서 kiemoon 아이디로 가장 먼저 가입하세요.

-- API가 새 테이블을 바로 인식하도록 새로고침
notify pgrst, 'reload schema';
