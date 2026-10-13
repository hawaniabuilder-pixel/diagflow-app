-- =====================================================================
-- Diagnostic IA — Phase 1 (complément) : table "clients" + colonnes manquantes
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- ⚠️ Ne recrée PAS la table "diagnostics" : elle existe déjà et contient vos données.
--    On lui ajoute seulement ce qui manque.
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- 1) Nouvelle table "clients" -------------------------------------------
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  nom_entreprise  text not null check (char_length(nom_entreprise) between 1 and 120),
  secteur         text,
  email           text check (email is null or char_length(email) <= 200),
  telephone       text check (telephone is null or char_length(telephone) <= 30),
  ca              text,
  effectif        text,
  notes           text check (notes is null or char_length(notes) <= 10000),
  statut          text not null default 'prospect'
                    check (statut in ('prospect', 'actif', 'ancien'))
);

-- Un même consultant ne peut pas avoir deux fiches avec le même nom d'entreprise
create unique index if not exists clients_user_nom_unique
  on public.clients (user_id, lower(nom_entreprise));

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- Sécurité : chaque consultant ne voit, ne crée, ne modifie et ne supprime que SES clients
alter table public.clients enable row level security;

drop policy if exists "Clients : lecture par son propriétaire"      on public.clients;
drop policy if exists "Clients : création par son propriétaire"     on public.clients;
drop policy if exists "Clients : modification par son propriétaire" on public.clients;
drop policy if exists "Clients : suppression par son propriétaire"  on public.clients;

create policy "Clients : lecture par son propriétaire"
  on public.clients for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients : création par son propriétaire"
  on public.clients for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Clients : modification par son propriétaire"
  on public.clients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Clients : suppression par son propriétaire"
  on public.clients for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 2) Colonnes ajoutées à "diagnostics" ------------------------------------
alter table public.diagnostics
  -- lien vers la fiche client (si la fiche est supprimée, le diagnostic reste, sans lien)
  add column if not exists client_id            uuid references public.clients (id) on delete set null,
  add column if not exists tags                 text[] not null default '{}',
  add column if not exists temps_passe_minutes  integer not null default 0 check (temps_passe_minutes >= 0);

create index if not exists diagnostics_client_idx on public.diagnostics (client_id);

-- 3) Reprise de l'existant : une fiche client par entreprise déjà diagnostiquée
insert into public.clients (user_id, nom_entreprise, secteur, ca, effectif)
select distinct on (d.user_id, lower(d.entreprise))
       d.user_id, d.entreprise, nullif(d.secteur, ''), d.ca, d.effectif::text
  from public.diagnostics d
 where not exists (
         select 1 from public.clients c
          where c.user_id = d.user_id and lower(c.nom_entreprise) = lower(d.entreprise))
 order by d.user_id, lower(d.entreprise), d.created_at desc;

update public.diagnostics d
   set client_id = c.id
  from public.clients c
 where d.client_id is null
   and c.user_id = d.user_id
   and lower(c.nom_entreprise) = lower(d.entreprise);

-- 4) Vérification : doit afficher "clients | true" et le nombre de fiches créées
select 'clients' as table_verifiee, rowsecurity as rls_active,
       (select count(*) from public.clients) as nombre_de_fiches
  from pg_tables where tablename = 'clients';
