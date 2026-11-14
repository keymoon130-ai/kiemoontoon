-- 내 소재함(템플릿): 1인당 20개, 공개 여부는 작가가 선택
create table if not exists public.templates (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  folder text not null default '기타',
  kind text not null check (kind in ('img','els')),
  path text not null,            -- 이미지(그림 소재) 또는 미리보기(요소 소재)
  data jsonb,                    -- 요소 소재: 말풍선·효과선 정보
  w int not null default 0,
  h int not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists templates_user on public.templates(user_id);
create index if not exists templates_public on public.templates(is_public) where is_public;

create or replace function public.templates_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.created_at := now();
    if (select count(*) from templates where user_id = auth.uid()) >= 20 then
      raise exception '소재는 1인당 20개까지 저장할 수 있어요';
    end if;
  else
    if not is_admin() then new.user_id := old.user_id; new.path := old.path; new.kind := old.kind; new.created_at := old.created_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists templates_guard on public.templates;
create trigger templates_guard before insert or update on public.templates
  for each row execute function public.templates_guard();

alter table public.templates enable row level security;
drop policy if exists t_sel on public.templates;
create policy t_sel on public.templates for select using (user_id = auth.uid() or is_public or is_admin());
drop policy if exists t_ins on public.templates;
create policy t_ins on public.templates for insert with check (user_id = auth.uid() and can_post());
drop policy if exists t_upd on public.templates;
create policy t_upd on public.templates for update using (user_id = auth.uid() or is_admin());
drop policy if exists t_del on public.templates;
create policy t_del on public.templates for delete using (user_id = auth.uid() or is_admin());

grant select on public.templates to anon, authenticated;
grant insert, update, delete on public.templates to authenticated;
notify pgrst, 'reload schema';
