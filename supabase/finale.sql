-- ========== 완결 잠금 + 후기 회차 ==========
alter table public.episodes add column if not exists kind text not null default 'ep';
alter table public.episodes drop constraint if exists episodes_kind_check;
alter table public.episodes add constraint episodes_kind_check check (kind in ('ep','after'));

create or replace function public.works_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.views := 0; new.rating_sum := 0; new.rating_count := 0;
    new.fav_count := 0; new.last_episode_at := null; new.created_at := now(); new.reject_reason := null;
    new.status := case when is_admin() then 'approved' else 'pending' end;
    new.deleted_at := null; new.deleted_by := null; new.deleted_why := null;
    return new;
  end if;
  if is_admin() then return new; end if;
  new.id := old.id; new.author_id := old.author_id; new.views := old.views; new.rating_sum := old.rating_sum;
  new.rating_count := old.rating_count; new.fav_count := old.fav_count;
  new.last_episode_at := old.last_episode_at; new.created_at := old.created_at;
  new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by; new.deleted_why := old.deleted_why;
  if old.finished and not new.finished then
    raise exception '완결된 작품은 작가가 되돌릴 수 없어요. 운영자에게 요청해 주세요';
  end if;
  if new.finished and not old.finished and old.status <> 'approved' then
    raise exception '승인된 작품만 완결할 수 있어요';
  end if;
  if old.status = 'rejected' then
    new.status := 'pending'; new.reject_reason := null;
  else
    new.status := old.status; new.reject_reason := old.reject_reason;
    new.title := old.title; new.description := old.description;
    new.genre := old.genre; new.thumb_path := old.thumb_path;
  end if;
  return new;
end $$;

create or replace function public.episodes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_fin boolean;
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.views := 0; new.rating_sum := 0; new.rating_count := 0;
    new.created_at := now(); new.reject_reason := null;
    new.deleted_at := null; new.deleted_by := null; new.deleted_why := null;
    new.kind := coalesce(new.kind, 'ep');
    select finished into v_fin from works where id = new.work_id;
    if coalesce(v_fin, false) and new.kind = 'ep' then
      raise exception '완결된 작품에는 후기만 올릴 수 있어요';
    end if;
    if not coalesce(v_fin, false) and new.kind = 'after' then
      raise exception '후기는 완결한 뒤에 올릴 수 있어요';
    end if;
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
    new.id := old.id; new.work_id := old.work_id; new.author_id := old.author_id; new.no := old.no; new.kind := old.kind;
    new.views := old.views; new.rating_sum := old.rating_sum; new.rating_count := old.rating_count;
    new.created_at := old.created_at; new.published_at := null;
    new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by; new.deleted_why := old.deleted_why;
    new.status := 'pending'; new.reject_reason := null;
  end if;
  if coalesce(array_length(new.pages, 1), 0) < 1 then
    raise exception '컷이 하나는 있어야 해요';
  end if;
  if new.kind = 'ep' then                     -- 후기는 분량·작업 시간 제한 없음
    if coalesce(array_length(new.pages, 1), 0) < 8 then
      raise exception '한 회차는 최소 8컷 이상이어야 해요';
    end if;
    if new.draw_seconds < 300 then
      raise exception '작업 시간이 5분 이상이어야 해요';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
