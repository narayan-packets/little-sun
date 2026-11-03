-- Little Sun (V1.3) Complete Idempotent Supabase Schema & Realtime Sync
-- Safe to run on both a brand-new Supabase project or an existing V1.0/V1.1/V1.2 project.

-- 1. Core Tables
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  status text not null default 'complete' check (status in ('complete','stopped','error')),
  model_id text,
  created_at timestamptz not null default now()
);

-- 2. Performance Indexes
create index if not exists idx_chats_user_updated on public.chats (user_id, updated_at desc);
create index if not exists idx_messages_chat_created on public.messages (chat_id, created_at asc);

-- 3. Automatic Chat Timestamp & Model Sync Trigger when a Message is Inserted
create or replace function public.sync_chat_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chats
  set
    updated_at = now(),
    model_id = coalesce(new.model_id, model_id)
  where id = new.chat_id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_chat_on_message on public.messages;
create trigger trg_sync_chat_on_message
  after insert on public.messages
  for each row
  execute function public.sync_chat_on_message();

-- 4. Row Level Security (RLS)
alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "own chats" on public.chats;
create policy "own chats" on public.chats
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 5. Enable Supabase Realtime Synchronization for Multi-Tab / Multi-Device Sync
alter table public.chats replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 6. Ephemeral Chat Attachments Storage Bucket & 1-Hour Expiration Policies (V1.7)
insert into storage.buckets (id, name, public)
values ('chat-uploads', 'chat-uploads', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload ephemeral attachments" on storage.objects;
create policy "Users can upload ephemeral attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Public read for ephemeral attachments" on storage.objects;
create policy "Public read for ephemeral attachments" on storage.objects
  for select
  using (bucket_id = 'chat-uploads');

drop policy if exists "Users can delete own ephemeral attachments" on storage.objects;
create policy "Users can delete own ephemeral attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

-- Ephemeral storage cleanup function (files older than 1 hour)
create or replace function public.delete_expired_ephemeral_uploads()
returns void
language plpgsql
security definer
as $$
begin
  delete from storage.objects
  where bucket_id = 'chat-uploads'
    and created_at < now() - interval '1 hour';
end;
$$;
