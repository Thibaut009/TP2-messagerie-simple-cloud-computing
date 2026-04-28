-- =============================================================================
-- TP2 Cloud Computing — Application de Messagerie Simple
-- Migration initiale : schéma, RLS, triggers
-- =============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- TABLE : profiles (auto-créée via trigger à l'inscription)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null unique,
  display_name text,
  avatar_url  text,
  created_at  timestamptz default now() not null
);
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- TABLE : conversations
-- ---------------------------------------------------------------------------
create table public.conversations (
  id          uuid default gen_random_uuid() primary key,
  name        text,
  is_group    boolean default false not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
alter table public.conversations enable row level security;

-- ---------------------------------------------------------------------------
-- TABLE : conversation_participants
-- ---------------------------------------------------------------------------
create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  joined_at       timestamptz default now() not null,
  primary key (conversation_id, user_id)
);
alter table public.conversation_participants enable row level security;

-- ---------------------------------------------------------------------------
-- TABLE : messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id              uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id       uuid references public.profiles(id) on delete set null,
  content         text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at      timestamptz default now() not null
);
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- INDEX pour les performances
-- ---------------------------------------------------------------------------
create index messages_conversation_id_idx on public.messages(conversation_id);
create index messages_created_at_idx      on public.messages(created_at desc);
create index cp_user_id_idx               on public.conversation_participants(user_id);

-- ---------------------------------------------------------------------------
-- TRIGGER : créer le profil automatiquement à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- TRIGGER : mettre à jour updated_at à chaque nouveau message
-- ---------------------------------------------------------------------------
create or replace function public.update_conversation_timestamp()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- ---------------------------------------------------------------------------
-- RLS POLICIES — profiles
-- ---------------------------------------------------------------------------
create policy "Authenticated users can view all profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RLS POLICIES — conversations
-- ---------------------------------------------------------------------------
create policy "Participants can view their conversations"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated
  with check (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- Fonction helper : vérifie l'appartenance sans déclencher le RLS
-- (security definer = s'exécute avec les droits du propriétaire, bypass RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_participant(conv_id uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS POLICIES — conversation_participants
-- ---------------------------------------------------------------------------
create policy "Participants can view members"
  on public.conversation_participants for select to authenticated
  using (
    public.is_participant(conversation_id, auth.uid())
  );

create policy "Users can join conversations"
  on public.conversation_participants for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS POLICIES — messages
-- ---------------------------------------------------------------------------
create policy "Participants can view messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- GRANTS — exposer les tables à l'API Data (REST/PostgREST)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant all on public.profiles              to authenticated;
grant all on public.conversations         to authenticated;
grant all on public.conversation_participants to authenticated;
grant all on public.messages              to authenticated;

-- Activer la réplication Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
