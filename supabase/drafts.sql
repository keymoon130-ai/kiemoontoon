-- ========== 서버 저장본 (그리다 멈추고 어느 기기에서든 이어 그리기) ==========
create table if not exists public.drafts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key text not null,                      -- ep:<작품id> / re:<회차id> / cover:<작품id|new>
  kind text not null check (kind in ('ep','after','re','cover')),
  work_id bigint references public.works(id) on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  title text not null default '',
  meta jsonb not null default '{}'::jsonb,
  files text[] not null default '{}',
  thumb text,
  cut_count int not null default 0,
  seconds int not null default 0,
  size_bytes bigint not null default 0,
  warned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists drafts_user on public.drafts(user_id);

create or replace function public.drafts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.created_at := now(); new.updated_at := now(); new.opened_at := now(); new.warned := false;
    if (select count(*) from drafts where user_id = auth.uid()) >= 5 then
      raise exception '저장본은 5개까지만 둘 수 있어요. MY › 그리던 작품에서 안 쓰는 걸 지워 주세요';
    end if;
    if new.work_id is not null and not exists (select 1 from works where id = new.work_id and author_id = auth.uid()) and not is_admin() then
      raise exception '내 작품에만 저장할 수 있어요';
    end if;
  else
    new.id := old.id; new.user_id := old.user_id; new.key := old.key; new.created_at := old.created_at;
    new.opened_at := now(); new.warned := false;
    if new.meta is distinct from old.meta then new.updated_at := now(); end if;
    if exists (select 1 from unnest(new.files) f where split_part(f, '/', 1) <> old.user_id::text) then
      raise exception '잘못된 파일 경로예요';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists drafts_guard on public.drafts;
create trigger drafts_guard before insert or update on public.drafts for each row execute function public.drafts_guard();

alter table public.drafts enable row level security;
grant select, insert, update, delete on public.drafts to authenticated;
drop policy if exists dr_sel on public.drafts;
create policy dr_sel on public.drafts for select using (user_id = auth.uid() or is_admin());
drop policy if exists dr_ins on public.drafts;
create policy dr_ins on public.drafts for insert with check (user_id = auth.uid() and can_post());
drop policy if exists dr_upd on public.drafts;
create policy dr_upd on public.drafts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists dr_del on public.drafts;
create policy dr_del on public.drafts for delete using (user_id = auth.uid() or is_admin());

-- 비공개 저장 공간 (본인만, 운영자는 보기·삭제만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drafts', 'drafts', false, 10485760, array['image/webp','image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/webp','image/png'];
drop policy if exists drafts_read on storage.objects;
create policy drafts_read on storage.objects for select to authenticated using (
  bucket_id = 'drafts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists drafts_write on storage.objects;
create policy drafts_write on storage.objects for insert to authenticated with check (
  bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists drafts_update on storage.objects;
create policy drafts_update on storage.objects for update to authenticated using (
  bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists drafts_delete on storage.objects;
create policy drafts_delete on storage.objects for delete to authenticated using (
  bucket_id = 'drafts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 30일 안 연 저장본 정리 + 7일 전 알림. 지울 파일 경로를 돌려줌
create or replace function public.drafts_maintain() returns text[]
language plpgsql security definer set search_path = public as $$
declare v_files text[] := '{}'; r record;
begin
  if auth.uid() is null then return v_files; end if;
  for r in select id, user_id, title, kind from drafts
    where user_id = auth.uid() and not warned and opened_at < now() - interval '23 days' and opened_at >= now() - interval '30 days' loop
    insert into notices (user_id, kind, title, message, link) values
      (r.user_id, 'reject', '그리던 그림이 곧 지워져요',
       '「' || coalesce(nullif(r.title, ''), '제목 없음') || '」 저장본을 30일 동안 열지 않아서 7일 뒤에 지워져요. 한 번 열어 두면 다시 30일 보관돼요.', 'my');
    perform set_config('app.bypass', 'on', true);
    update drafts set warned = true where id = r.id;
    perform set_config('app.bypass', 'off', true);
  end loop;
  for r in select id, user_id, files from drafts
    where opened_at < now() - interval '30 days' and (user_id = auth.uid() or is_admin()) loop
    v_files := v_files || r.files;
    delete from drafts where id = r.id;
  end loop;
  return v_files;
end $$;
grant execute on function public.drafts_maintain() to authenticated;
notify pgrst, 'reload schema';
