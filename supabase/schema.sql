-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

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
-- TABLA: voice_sessions (MODIFICADO)
-- ============================================
create table if not exists public.voice_sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id text, -- AHORA ES TEXT (Desacoplado de conversations.id)
    transcript jsonb not null default '[]'::jsonb,
    audio_url text,
    created_at timestamptz not null default now()
);

create index if not exists idx_voice_sessions_user_id on public.voice_sessions(user_id);
-- Index importante para buscar por el ID de texto externo
create index if not exists idx_voice_sessions_conversation_id on public.voice_sessions(conversation_id);

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
-- STORAGE & POLICIES (ARCHIVOS)
-- ============================================

-- 1. BUCKET: chat-assets
insert into storage.buckets (id, name, public)
values ('chat-assets', 'chat-assets', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload chat assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-assets');

create policy "Public can view chat assets"
on storage.objects for select to public
using (bucket_id = 'chat-assets');

-- 2. BUCKET: voice-sessions (NUEVO)
insert into storage.buckets (id, name, public)
values ('voice-sessions', 'voice-sessions', false) -- Privado por defecto (acceso vía RLS)
on conflict (id) do nothing;

-- NUEVA POLÍTICA: Solo SELECT para authenticated
create policy "Authenticated users can listen to voice sessions"
on storage.objects for select
to authenticated
using (bucket_id = 'voice-sessions');

-- Nota: No se añaden políticas INSERT/UPDATE/DELETE para 'authenticated' 
-- porque la subida de audio se gestionará desde el Backend (Service Role).
