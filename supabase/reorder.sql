-- ========== 회차 컷 순서 바꾸기 (내용은 그대로라 재승인 없음) ==========
create or replace function public.reorder_pages(p_id bigint, p_pages text[]) returns void
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select * into e from episodes where id = p_id and deleted_at is null;
  if e.id is null then raise exception '회차를 찾을 수 없어요'; end if;
  if e.author_id <> auth.uid() and not is_admin() then raise exception '내 회차만 바꿀 수 있어요'; end if;
  if not is_admin() and not can_act() then raise exception '정지 상태에서는 바꿀 수 없어요'; end if;
  if (select array_agg(x order by x) from unnest(p_pages) x) is distinct from (select array_agg(x order by x) from unnest(e.pages) x) then
    raise exception '컷 순서만 바꿀 수 있어요';
  end if;
  perform set_config('app.bypass', 'on', true);
  update episodes set pages = p_pages where id = p_id;
  perform set_config('app.bypass', 'off', true);
end $$;
grant execute on function public.reorder_pages(bigint, text[]) to authenticated;
notify pgrst, 'reload schema';
