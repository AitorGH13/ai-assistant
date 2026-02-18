-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector; -- Para búsqueda semántica

-- ============================================
-- TABLA: profiles
-- ============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- TRIGGER: Sincronizar auth.users con profiles
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
    
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();

-- ============================================
-- TABLA: conversations
-- ============================================
create table if not exists public.conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    history jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_updated_at on public.conversations(updated_at desc);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_conversations_updated_at
    before update on public.conversations
    for each row
    execute function update_updated_at_column();

-- ============================================
-- TABLA: voice_sessions
-- ============================================
create table if not exists public.voice_sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id text, 
    transcript jsonb not null default '[]'::jsonb,
    audio_url text, -- Guardaremos el PATH relativo (ej: "user_123/audio.mp3")
    created_at timestamptz not null default now()
);

create index if not exists idx_voice_sessions_user_id on public.voice_sessions(user_id);
create index if not exists idx_voice_sessions_conversation_id on public.voice_sessions(conversation_id);

-- ============================================
-- TABLA: documents (Base de Conocimiento)
-- ============================================
create table if not exists public.documents (
  id bigserial primary key,
  content text,
  embedding vector(1536)
);

-- Función de búsqueda vectorial
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- ============================================
-- ROW LEVEL SECURITY (RLS) - DATOS
-- ============================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.voice_sessions enable row level security;

-- POLICIES: profiles
create policy "Users can select own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid());

-- POLICIES: conversations
create policy "Users can select own conversations" on public.conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on public.conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations" on public.conversations for delete using (auth.uid() = user_id);

-- POLICIES: voice_sessions
create policy "Users can select own voice sessions" on public.voice_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own voice sessions" on public.voice_sessions for insert with check (auth.uid() = user_id);

-- ============================================
-- STORAGE & POLICIES (SECURE / PRIVATE)
-- ============================================

-- 1. BUCKET: chat-assets (Privado)
insert into storage.buckets (id, name, public)
values ('chat-assets', 'chat-assets', false) -- CAMBIADO A FALSE
on conflict (id) do update set public = false;

create policy "Auth users select own chat assets"
on storage.objects for select to authenticated
using (bucket_id = 'chat-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Nota: La política asume estructura de carpeta: user_id/archivo.ext

create policy "Auth users upload chat assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-assets' AND auth.uid()::text = (storage.foldername(name))[1]);


-- 2. BUCKET: voice-sessions (Privado)
insert into storage.buckets (id, name, public)
values ('voice-sessions', 'voice-sessions', false)
on conflict (id) do update set public = false;

create policy "Auth users listen own voice sessions"
on storage.objects for select to authenticated
using (
    bucket_id = 'voice-sessions' 
    AND 
    auth.uid()::text = (storage.foldername(name))[1]
);


-- 3. BUCKET: media-uploads (Privado)
insert into storage.buckets (id, name, public)
values ('media-uploads', 'media-uploads', false) -- CAMBIADO A FALSE
on conflict (id) do update set public = false;

create policy "Auth users select own media"
on storage.objects for select to authenticated
using (bucket_id = 'media-uploads');

create policy "Auth users upload media"
on storage.objects for insert to authenticated
with check (bucket_id = 'media-uploads');

