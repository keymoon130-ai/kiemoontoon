-- 최소 작업 시간 10분 → 5분 변경 (SQL Editor에서 한 번 실행)
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
