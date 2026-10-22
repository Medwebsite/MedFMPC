-- =====================================================================
--  MedFMPC — Schéma de la base de données (Supabase)
--  À coller dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. PROFILS & RÔLES -------------------------------------
-- role : 'admin'  = admin principal (toi)  -> gère les membres + tout le contenu
--        'editor' = éditeur                -> ajoute leçons, plannings, actualités
--        'user'   = compte simple          -> lecture seule (comme un visiteur)

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text unique,
  nom         text,
  role        text not null default 'user' check (role in ('admin','editor','user')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Crée automatiquement un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nom)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nom',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fonctions utilitaires pour les règles de sécurité
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','editor'), false)
$$;

drop policy if exists "profil: lire le sien ou admin" on public.profiles;
create policy "profil: lire le sien ou admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profil: seul l'admin modifie" on public.profiles;
create policy "profil: seul l'admin modifie" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. ACTUALITÉS ------------------------------------------
create table if not exists public.news (
  id          bigint generated always as identity primary key,
  titre       text not null,
  contenu     text not null default '',
  categorie   text not null default 'Info',
  image_url   text,
  image_path  text,
  epingle     boolean not null default false,
  auteur      uuid default auth.uid() references public.profiles(id) on delete set null,
  auteur_nom  text,
  created_at  timestamptz not null default now()
);

-- ---------- 3. PLANNINGS -------------------------------------------
create table if not exists public.plannings (
  id           bigint generated always as identity primary key,
  titre        text not null,
  filiere      text not null,          -- 'medecine' | 'pharmacie'
  annee        int  not null,
  periode      text,                   -- ex : "Semestre 1", "Semaine du 3 nov."
  fichier_url  text not null,
  fichier_path text,
  type         text not null default 'pdf',  -- 'pdf' | 'image'
  auteur       uuid default auth.uid() references public.profiles(id) on delete set null,
  auteur_nom   text,
  created_at   timestamptz not null default now()
);

-- ---------- 4. LEÇONS AJOUTÉES PAR LES ÉDITEURS --------------------
-- (le contenu du Drive est lu directement ; cette table sert aux ajouts)
create table if not exists public.lessons (
  id           bigint generated always as identity primary key,
  filiere      text not null,
  annee        int  not null,
  semestre     text,                   -- 'S1' … 'S12'
  module       text not null,
  titre        text not null,
  description  text,
  lien         text,                   -- lien externe (Drive, YouTube…)
  fichier_url  text,                   -- ou fichier envoyé sur le site
  fichier_path text,
  auteur       uuid default auth.uid() references public.profiles(id) on delete set null,
  auteur_nom   text,
  created_at   timestamptz not null default now()
);

alter table public.lessons add column if not exists semestre text;

-- Règles : tout le monde lit, seuls admin/éditeurs écrivent
do $$
declare t text;
begin
  foreach t in array array['news','plannings','lessons'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lecture publique" on public.%I', t);
    execute format('create policy "lecture publique" on public.%I for select using (true)', t);
    execute format('drop policy if exists "editeurs ajoutent" on public.%I', t);
    execute format('create policy "editeurs ajoutent" on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('drop policy if exists "editeurs modifient" on public.%I', t);
    execute format('create policy "editeurs modifient" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('drop policy if exists "editeurs suppriment" on public.%I', t);
    execute format('create policy "editeurs suppriment" on public.%I for delete to authenticated using (public.is_editor())', t);
  end loop;
end $$;

-- ---------- 5. STOCKAGE DES FICHIERS (PDF, images) -----------------
insert into storage.buckets (id, name, public)
values ('fichiers', 'fichiers', true)
on conflict (id) do update set public = true;

drop policy if exists "fichiers: editeurs envoient" on storage.objects;
create policy "fichiers: editeurs envoient" on storage.objects
  for insert to authenticated with check (bucket_id = 'fichiers' and public.is_editor());

drop policy if exists "fichiers: editeurs modifient" on storage.objects;
create policy "fichiers: editeurs modifient" on storage.objects
  for update to authenticated using (bucket_id = 'fichiers' and public.is_editor());

drop policy if exists "fichiers: editeurs suppriment" on storage.objects;
create policy "fichiers: editeurs suppriment" on storage.objects
  for delete to authenticated using (bucket_id = 'fichiers' and public.is_editor());

-- =====================================================================
--  6. DEVENIR ADMIN PRINCIPAL
--  1) Crée ton compte sur le site (bouton « Connexion » > « Créer un compte »)
--  2) Remplace l'email ci-dessous par le tien, puis exécute UNIQUEMENT
--     cette ligne dans le SQL Editor :
--
--  update public.profiles set role = 'admin' where email = 'TON_EMAIL@exemple.com';
-- =====================================================================
