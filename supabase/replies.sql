-- ========== 답글 ==========
alter table public.comments add column if not exists parent_id bigint references public.comments(id) on delete cascade,
                            add column if not exists reply_count int not null default 0,
                            add column if not exists deleted boolean not null default false;
create index if not exists comments_parent on public.comments(parent_id);
alter table public.notices add column if not exists link text;

create or replace function public.comments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; v_name text; v_where text;
begin
  new.user_id := auth.uid(); new.like_count := 0; new.reply_count := 0; new.deleted := false; new.created_at := now();
  if new.parent_id is not null then
    select * into p from comments where id = new.parent_id;
    if p.id is null or p.deleted then raise exception '답글을 달 댓글을 찾을 수 없어요'; end if;
    if p.parent_id is not null then raise exception '답글에는 답글을 달 수 없어요'; end if;
    new.episode_id := p.episode_id;
  end if;
  return new;
end $$;
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert on public.comments for each row execute function public.comments_guard();

-- 답글 수 세기 + 답글 알림
create or replace function public.replies_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; v_name text; v_where text;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is null then return null; end if;
    update comments set reply_count = reply_count + 1 where id = new.parent_id returning * into p;
    if p.user_id <> new.user_id then
      select display_name into v_name from profiles where id = new.user_id;
      select w.title || ' · ' || e.title into v_where from episodes e join works w on w.id = e.work_id where e.id = new.episode_id;
      insert into notices (user_id, kind, title, message, target, link) values
        (p.user_id, 'reply', coalesce(v_name, '누군가') || '님이 내 댓글에 답글을 달았어요', left(new.body, 100), '「' || v_where || '」', 'view-' || new.episode_id);
    end if;
  elsif old.parent_id is not null then
    update comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    -- 지워진 댓글에 남은 답글이 없으면 그 자리도 정리
    delete from comments where id = old.parent_id and deleted and reply_count = 0;
  end if;
  return null;
end $$;
drop trigger if exists replies_after on public.comments;
create trigger replies_after after insert or delete on public.comments for each row execute function public.replies_after();

-- 댓글 지우기: 답글이 있으면 "삭제된 댓글" 자리만 남기고, 없으면 완전히 지움
create or replace function public.delete_comment(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from comments where id = p_id;
  if c.id is null or c.deleted then raise exception '이미 지워진 댓글이에요'; end if;
  if c.user_id <> auth.uid() and not is_admin() then raise exception '내 댓글만 지울 수 있어요'; end if;
  if c.parent_id is null and c.reply_count > 0 then
    update comments set deleted = true, body = '삭제된 댓글이에요', like_count = 0 where id = p_id;
    delete from comment_likes where comment_id = p_id;
  else
    delete from comments where id = p_id;
  end if;
end $$;
grant execute on function public.delete_comment(bigint) to authenticated;
drop policy if exists c_del on public.comments;

notify pgrst, 'reload schema';
