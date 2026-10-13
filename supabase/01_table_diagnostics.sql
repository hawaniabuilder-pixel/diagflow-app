-- =====================================================================
-- Diagnostic IA — Phase 1 : table "diagnostics"
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- 1) La table ----------------------------------------------------------
create table if not exists public.diagnostics (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Le consultant propriétaire. Rempli automatiquement avec l'utilisateur connecté.
  -- "on delete cascade" : si le compte est supprimé, ses diagnostics aussi (RGPD).
  user_id               uuid not null default auth.uid()
                          references auth.users (id) on delete cascade,

  -- Informations sur l'entreprise cliente
  entreprise            text not null check (char_length(entreprise) between 1 and 120),
  secteur               text not null default '',
  ca                    text,
  effectif              integer check (effectif between 1 and 50),
  ville                 text default 'Île-de-France',

  -- Entretien et contexte
  transcription         text not null default '',
  outils_existants      jsonb not null default '[]'::jsonb,
  objectifs             jsonb not null default '[]'::jsonb,
  taux_horaire          numeric(10, 2) not null default 40
                          check (taux_horaire >= 0 and taux_horaire <= 500),

  -- Résultat de l'IA
  diagnostic_json       jsonb,          -- version en cours (celle que le consultant modifie)
  diagnostic_ia_original jsonb,         -- version brute de l'IA, pour "Revenir à la version IA"
  diagnostic_text       text,           -- résumé texte (recherche, email)

  statut                text not null default 'brouillon'
                          check (statut in ('brouillon', 'analysé', 'validé', 'envoyé', 'clos')),

  -- RGPD : preuve du consentement
  consentement_rgpd     boolean not null default false,
  consentement_rgpd_at  timestamptz,

  -- Partage client
  lien_partage          uuid unique,
  expires_at            timestamptz,
  vu_par_client         boolean not null default false,
  nb_vues               integer not null default 0,
  last_viewed_at        timestamptz
);

-- Accélère l'affichage "mes diagnostics, du plus récent au plus ancien"
create index if not exists diagnostics_user_created_idx
  on public.diagnostics (user_id, created_at desc);

-- 2) Mise à jour automatique de updated_at ----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists diagnostics_set_updated_at on public.diagnostics;
create trigger diagnostics_set_updated_at
  before update on public.diagnostics
  for each row execute function public.set_updated_at();

-- 3) Row Level Security : chaque consultant ne voit QUE ses diagnostics --
alter table public.diagnostics enable row level security;

drop policy if exists "Users can see own diagnostics"    on public.diagnostics;
drop policy if exists "Users can insert own diagnostics" on public.diagnostics;
drop policy if exists "Users can update own diagnostics" on public.diagnostics;
drop policy if exists "Users can delete own diagnostics" on public.diagnostics;

create policy "Users can see own diagnostics"
  on public.diagnostics for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own diagnostics"
  on public.diagnostics for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own diagnostics"
  on public.diagnostics for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own diagnostics"
  on public.diagnostics for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4) Accès public par lien de partage ---------------------------------
-- IMPORTANT : on ne crée PAS de policy "select pour tout le monde si statut = envoyé".
-- Une telle policy permettrait à n'importe qui, avec la clé anon (visible dans le
-- navigateur), de lister TOUS les rapports envoyés, transcriptions comprises.
-- À la place : une fonction qui ne renvoie qu'UN rapport, et seulement si on
-- connaît son UUID de partage. Elle compte aussi les vues.
create or replace function public.get_rapport_partage(p_lien uuid)
returns table (
  entreprise      text,
  secteur         text,
  created_at      timestamptz,
  diagnostic_json jsonb,
  expires_at      timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.diagnostics d
     set vu_par_client  = true,
         nb_vues        = d.nb_vues + 1,
         last_viewed_at = now()
   where d.lien_partage = p_lien
     and d.statut = 'envoyé'
     and d.expires_at > now();

  return query
    select d.entreprise, d.secteur, d.created_at, d.diagnostic_json, d.expires_at
      from public.diagnostics d
     where d.lien_partage = p_lien
       and d.statut = 'envoyé'
       and d.expires_at > now();
end;
$$;

revoke all on function public.get_rapport_partage(uuid) from public;
grant execute on function public.get_rapport_partage(uuid) to anon, authenticated;

-- 5) Vérification : doit afficher "true" dans la colonne rowsecurity
select tablename, rowsecurity from pg_tables where tablename = 'diagnostics';
