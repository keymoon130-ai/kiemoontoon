-- ========== BGM ==========
-- 작가 음악함 (1인당 10곡, 한 곡 최대 3분)
create table if not exists public.songs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  path text not null,
  seconds int not null check (seconds between 1 and 182),
  size int not null default 0 check (size <= 5242880),
  created_at timestamptz not null default now()
);
create index if not exists songs_user on public.songs(user_id);

create or replace function public.songs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid(); new.created_at := now();
  if split_part(new.path, '/', 1) <> auth.uid()::text or split_part(new.path, '/', 2) <> 'bgm' then
    raise exception '잘못된 음악 경로예요';
  end if;
  if (select count(*) from songs where user_id = auth.uid()) >= 10 then
    raise exception '음악함에는 10곡까지만 넣을 수 있어요. 안 쓰는 곡을 지워 주세요';
  end if;
  return new;
end $$;
drop trigger if exists songs_guard on public.songs;
create trigger songs_guard before insert on public.songs for each row execute function public.songs_guard();

grant select on public.songs to anon, authenticated;
grant insert, update on public.songs to authenticated;
alter table public.songs enable row level security;
drop policy if exists s_sel on public.songs;
create policy s_sel on public.songs for select using (true);
drop policy if exists s_ins on public.songs;
create policy s_ins on public.songs for insert with check (user_id = auth.uid() and can_post());
drop policy if exists s_upd on public.songs;
create policy s_upd on public.songs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 곡 지우기: 회차에서 쓰고 있으면 막음. 지울 파일 경로를 돌려줌
create or replace function public.delete_song(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_path text; n int;
begin
  select user_id, path into v_user, v_path from songs where id = p_id;
  if v_user is null then raise exception '곡을 찾을 수 없어요'; end if;
  if v_user <> auth.uid() and not is_admin() then raise exception '내 곡만 지울 수 있어요'; end if;
  select count(*) into n from episodes where bgm is not null and bgm::text like '%' || v_path || '%';
  if n > 0 then raise exception '회차 %개에서 쓰고 있는 곡이라 지울 수 없어요', n; end if;
  delete from songs where id = p_id;
  return v_path;
end $$;
grant execute on function public.delete_song(bigint) to authenticated;

-- 회차 BGM 설정 {mode:'one'|'scene', list:[{at, s, t}]}
alter table public.episodes add column if not exists bgm jsonb;
alter table public.episodes drop constraint if exists episodes_bgm_size;
alter table public.episodes add constraint episodes_bgm_size check (bgm is null or (jsonb_typeof(bgm) = 'object' and length(bgm::text) < 6000));

-- 음악 파일도 올릴 수 있게
update storage.buckets set allowed_mime_types = array['image/webp','image/png','image/jpeg','audio/mpeg'] where id = 'toon';

notify pgrst, 'reload schema';
