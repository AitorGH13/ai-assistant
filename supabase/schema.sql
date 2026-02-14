-- ==============================================================================
-- 1. CONFIGURACIÓN INICIAL Y EXTENSIONES
-- ==============================================================================
-- Habilita pgcrypto para generar UUIDs si es necesario
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. TABLAS PRINCIPALES
-- ==============================================================================

-- 2.1 TABLA PROFILES
-- Se vincula automáticamente con auth.users.
-- Ya incluye las columnas 'full_name' y 'avatar_url' desde el inicio.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 TABLA CONVERSATIONS
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.3 TABLA MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content jsonb not null,
  tool_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2.4 TABLA TTS_AUDIOS
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

-- ==============================================================================
-- 3. AUTOMATIZACIÓN (TRIGGERS Y FUNCIONES)
-- ==============================================================================

-- 3.1 FUNCIÓN PARA MANEJAR NUEVOS USUARIOS (CRÍTICO)
-- Captura el email y los metadatos (full_name) enviados desde React al registrarse
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
  );
  return new;
end;
$$;

-- Trigger que se dispara cada vez que alguien se registra en Supabase Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3.2 FUNCIÓN GENÉRICA PARA ACTUALIZAR 'UPDATED_AT'
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger para profiles
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Trigger para conversations
drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

-- ==============================================================================
-- 4. ÍNDICES (OPTIMIZACIÓN DE RENDIMIENTO)
-- ==============================================================================
create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists tts_audios_conversation_id_idx on public.tts_audios(conversation_id);
create index if not exists profiles_email_idx on public.profiles(email);

-- ==============================================================================
-- 5. SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Habilitamos RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tts_audios enable row level security;

-- 5.1 POLÍTICAS PARA PROFILES
-- Ver propio perfil
create policy "Usuarios pueden ver su propio perfil" 
on public.profiles for select 
to authenticated 
using (id = auth.uid());

-- Actualizar propio perfil
create policy "Usuarios pueden editar su propio perfil" 
on public.profiles for update 
to authenticated 
using (id = auth.uid());

-- 5.2 POLÍTICAS PARA CONVERSATIONS
create policy "Ver propias conversaciones" 
on public.conversations for select 
to authenticated 
using (user_id = auth.uid());

create policy "Crear propias conversaciones" 
on public.conversations for insert 
to authenticated 
with check (user_id = auth.uid());

create policy "Editar propias conversaciones" 
on public.conversations for update 
to authenticated 
using (user_id = auth.uid());

create policy "Borrar propias conversaciones" 
on public.conversations for delete 
to authenticated 
using (user_id = auth.uid());

-- 5.3 POLÍTICAS PARA MESSAGES
-- Acceso basado en si eres dueño de la conversación padre
create policy "Ver mensajes de mis conversaciones" 
on public.messages for select 
to authenticated 
using (exists (
  select 1 from public.conversations c 
  where c.id = conversation_id and c.user_id = auth.uid()
));

create policy "Insertar mensajes en mis conversaciones" 
on public.messages for insert 
to authenticated 
with check (exists (
  select 1 from public.conversations c 
  where c.id = conversation_id and c.user_id = auth.uid()
));

-- 5.4 POLÍTICAS PARA TTS_AUDIOS
create policy "Ver audios de mis conversaciones" 
on public.tts_audios for select 
to authenticated 
using (exists (
  select 1 from public.conversations c 
  where c.id = conversation_id and c.user_id = auth.uid()
));

create policy "Insertar audios en mis conversaciones" 
on public.tts_audios for insert 
to authenticated 
with check (exists (
  select 1 from public.conversations c 
  where c.id = conversation_id and c.user_id = auth.uid()
));