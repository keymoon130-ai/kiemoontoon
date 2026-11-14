-- ========== 표지 바꾸기 (승인된 작품은 운영자 승인 후 교체) ==========
alter table public.works add column if not exists pending_thumb text;

create or replace function public.works_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if bypassing() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.views := 0; new.rating_sum := 0; new.rating_count := 0;
    new.fav_count := 0; new.last_episode_at := null; new.created_at := now(); new.reject_reason := null;
    new.status := case when is_admin() then 'approved' else 'pending' end;
    new.deleted_at := null; new.deleted_by := null; new.deleted_why := null; new.pending_thumb := null;
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
  -- 새 표지 신청: 내 폴더의 파일만, 승인된 작품만
  if new.pending_thumb is distinct from old.pending_thumb then
    if old.status <> 'approved' then raise exception '승인된 작품만 표지 변경을 신청할 수 있어요'; end if;
    if new.pending_thumb is not null and split_part(new.pending_thumb, '/', 1) <> auth.uid()::text then
      raise exception '잘못된 표지 경로예요';
    end if;
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

-- 운영자: 표지 변경 승인/거절. 지울 파일 경로를 돌려줌
create or replace function public.review_cover(p_id bigint, p_ok boolean, p_reason text default '') returns text[]
language plpgsql security definer set search_path = public as $$
declare w record; v_old text;
begin
  if not is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select * into w from works where id = p_id;
  if w.id is null or w.pending_thumb is null then raise exception '표지 변경 신청을 찾을 수 없어요'; end if;
  if not p_ok and coalesce(trim(p_reason), '') = '' then raise exception '거절 사유를 적어 주세요'; end if;
  if p_ok then
    v_old := w.thumb_path;
    update works set thumb_path = w.pending_thumb, pending_thumb = null where id = p_id;
    insert into notices (user_id, kind, title, message, link) values
      (w.author_id, 'approve', '표지 변경이 승인됐어요', '「' || w.title || '」의 새 표지가 공개됐어요!', 'work-' || p_id);
    return case when v_old is null then '{}'::text[]
      else array[v_old, regexp_replace(v_old, '\.(webp|jpg)$', '_og.jpg')] end;
  else
    update works set pending_thumb = null where id = p_id;
    insert into notices (user_id, kind, title, message, level, target, link) values
      (w.author_id, 'reject', '표지 변경이 반려됐어요', p_reason, 0, '작품 「' || w.title || '」', 'work-' || p_id);
    return array[w.pending_thumb, regexp_replace(w.pending_thumb, '\.(webp|jpg)$', '_og.jpg')];
  end if;
end $$;
grant execute on function public.review_cover(bigint, boolean, text) to authenticated;

-- 영구 삭제할 때 대기 중인 새 표지도 같이 지우기
create or replace function public.purge_paths(p_kind text, p_id bigint) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p) filter (where p is not null), '{}') from (
    select w.thumb_path as p from works w where p_kind = 'work' and w.id = p_id
    union all select regexp_replace(w.thumb_path, '\.(webp|jpg)$', '_og.jpg') from works w where p_kind = 'work' and w.id = p_id
    union all select w.pending_thumb from works w where p_kind = 'work' and w.id = p_id
    union all select regexp_replace(w.pending_thumb, '\.(webp|jpg)$', '_og.jpg') from works w where p_kind = 'work' and w.id = p_id
    union all select unnest(e.pages) from episodes e where (p_kind = 'work' and e.work_id = p_id) or (p_kind = 'episode' and e.id = p_id)
    union all select e.thumb_path from episodes e where (p_kind = 'work' and e.work_id = p_id) or (p_kind = 'episode' and e.id = p_id)
  ) s;
$$;
revoke execute on function public.purge_paths(text, bigint) from public, anon, authenticated;

notify pgrst, 'reload schema';
