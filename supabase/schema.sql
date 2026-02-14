-- ============================================
-- EXTENSIONES
-- ============================================
create extension if not exists pgcrypto;

-- ============================================
-- TABLA: profiles
-- ============================================
-- Complementa la información de auth.users (gestionada por Supabase)
-- auth.users contiene: email, password (encriptado), email_confirmed_at, etc.
-- Esta tabla profiles permite agregar campos personalizados del usuario
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
-- Cuando se crea un usuario en auth.users, automáticamente se crea su perfil
-- Actualizamos la función para que capture el full_name y avatar_url desde los metadatos
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

-- Trigger para actualizar updated_at en profiles
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
-- Agrupa mensajes de chat y audios TTS por conversación
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- TABLA: messages
-- ============================================
-- Almacena mensajes de chat (usuario y asistente)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content jsonb not null,
  tool_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- TABLA: tts_audios
-- ============================================
-- Almacena audios generados con Text-to-Speech
create table if not exists public.tts_audios (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  text text not null,
  audio_url text not null,
  timestamp_ms bigint not null,
  voice_id text not null,
  voice_name text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- ÍNDICES
-- ============================================
create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists tts_audios_conversation_id_idx on public.tts_audios(conversation_id);
create index if not exists tts_audios_created_at_idx on public.tts_audios(created_at);
create index if not exists profiles_email_idx on public.profiles(email);

-- ============================================
-- TRIGGER: updated_at para conversations
-- ============================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tts_audios enable row level security;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tts_audios enable row level security;

-- ============================================
-- RLS POLICIES: profiles
-- ============================================
-- Los usuarios solo pueden ver y editar su propio perfil
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ============================================
-- RLS POLICIES: conversations
-- ============================================
-- Los usuarios solo pueden acceder a sus propias conversaciones
drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own
on public.conversations for select
to authenticated
using (user_id = auth.uid());

drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own
on public.conversations for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own
on public.conversations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own
on public.conversations for delete
to authenticated
using (user_id = auth.uid());

-- ============================================
-- RLS POLICIES: messages
-- ============================================
-- Los usuarios solo pueden acceder a mensajes de sus propias conversaciones

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
on public.messages for insert
to authenticated
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
on public.messages for update
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own
on public.messages for delete
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

-- ============================================
-- RLS POLICIES: tts_audios
-- ============================================
-- Los usuarios solo pueden acceder a audios TTS de sus propias conversaciones

drop policy if exists tts_audios_select_own on public.tts_audios;
create policy tts_audios_select_own
on public.tts_audios for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = tts_audios.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists tts_audios_insert_own on public.tts_audios;
create policy tts_audios_insert_own
on public.tts_audios for insert
to authenticated
with check (
  exists (
    select 1 from public.conversations c
    where c.id = tts_audios.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists tts_audios_update_own on public.tts_audios;
create policy tts_audios_update_own
on public.tts_audios for update
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = tts_audios.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = tts_audios.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists tts_audios_delete_own on public.tts_audios;
create policy tts_audios_delete_own
on public.tts_audios for delete
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = tts_audios.conversation_id
      and c.user_id = auth.uid()
  )
);
