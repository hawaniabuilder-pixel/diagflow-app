-- =====================================================================
-- Diagnostic IA — Offre ÉQUIPE : équipes, rôles, invitations, partage
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
--
-- Rôles :
--   • Admin      : gère l'équipe (invite, change les rôles, retire), crée ses diagnostics,
--                  voit ET peut modifier les diagnostics partagés.        → prend 1 place
--   • Consultant : crée ses diagnostics, voit les diagnostics partagés.   → prend 1 place
--   • Viewer     : voit seulement les diagnostics partagés (lecture seule) → GRATUIT, illimité
-- Licence : 99 €/mois pour 5 places (Admin + Consultants). Essai gratuit de 14 jours à la création.
-- Un diagnostic reste PRIVÉ tant que son auteur ne coche pas « Partager avec l'équipe ».
-- =====================================================================

-- 1) Les tables ---------------------------------------------------------
create table if not exists public.equipes (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  nom               text not null check (char_length(btrim(nom)) between 1 and 120),
  proprietaire_id   uuid references auth.users (id) on delete set null,
  places_max        integer not null default 5 check (places_max between 1 and 500),
  essai_jusqu_au    timestamptz not null default (now() + interval '14 days'),
  licence_active    boolean not null default false,   -- passe à true quand le client paie
  licence_jusqu_au  timestamptz                       -- facultatif : fin de la période payée
);

create table if not exists public.membres_equipe (
  equipe_id   uuid not null references public.equipes (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'consultant', 'viewer')),
  email       text,
  created_at  timestamptz not null default now(),
  primary key (equipe_id, user_id)
);
-- Une personne = une seule équipe
create unique index if not exists membres_equipe_une_equipe_par_personne on public.membres_equipe (user_id);

create table if not exists public.invitations_equipe (
  id            uuid primary key default gen_random_uuid(),
  equipe_id     uuid not null references public.equipes (id) on delete cascade,
  email         text not null check (char_length(email) between 3 and 200),
  role          text not null check (role in ('admin', 'consultant', 'viewer')),
  jeton         uuid not null unique default gen_random_uuid(),  -- la partie secrète du lien d'invitation
  invite_par    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  acceptee_at   timestamptz,
  acceptee_par  uuid references auth.users (id) on delete set null
);
-- Une seule invitation en attente par email et par équipe
create unique index if not exists invitations_une_en_attente
  on public.invitations_equipe (equipe_id, lower(email)) where acceptee_at is null;

-- Case « Partager avec l'équipe » sur chaque diagnostic (décochée par défaut = privé)
alter table public.diagnostics add column if not exists partage_equipe boolean not null default false;


-- 2) Petites fonctions de contrôle (utilisées par les règles de sécurité) ----
-- L'équipe a-t-elle le droit de travailler ? (essai en cours OU licence payée)
create or replace function public.equipe_active(p_equipe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (e.licence_active and (e.licence_jusqu_au is null or e.licence_jusqu_au > now()))
           or e.essai_jusqu_au > now()
      from public.equipes e where e.id = p_equipe), false)
$$;

-- Mon équipe et mon rôle (null si je n'ai pas d'équipe)
create or replace function public.mon_equipe()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.equipe_id from public.membres_equipe m where m.user_id = auth.uid()
$$;

create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.membres_equipe m where m.user_id = auth.uid()
$$;

-- Cette personne est-elle dans MON équipe (et l'équipe est-elle active) ?
create or replace function public.meme_equipe(p_autre uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.membres_equipe moi
      join public.membres_equipe lui on lui.equipe_id = moi.equipe_id
     where moi.user_id = auth.uid()
       and lui.user_id = p_autre
       and public.equipe_active(moi.equipe_id))
$$;

-- Suis-je Admin de l'équipe de cette personne ?
create or replace function public.admin_equipe_de(p_autre uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.membres_equipe moi
      join public.membres_equipe lui on lui.equipe_id = moi.equipe_id
     where moi.user_id = auth.uid()
       and moi.role = 'admin'
       and lui.user_id = p_autre
       and public.equipe_active(moi.equipe_id))
$$;


-- 3) Sécurité (RLS) ------------------------------------------------------
alter table public.equipes            enable row level security;
alter table public.membres_equipe     enable row level security;
alter table public.invitations_equipe enable row level security;

drop policy if exists "Équipe : lecture de la sienne" on public.equipes;
create policy "Équipe : lecture de la sienne"
  on public.equipes for select to authenticated
  using (id = public.mon_equipe());

drop policy if exists "Membres : lecture de son équipe" on public.membres_equipe;
create policy "Membres : lecture de son équipe"
  on public.membres_equipe for select to authenticated
  using (equipe_id = public.mon_equipe());

drop policy if exists "Invitations : lecture par l'Admin" on public.invitations_equipe;
create policy "Invitations : lecture par l'Admin"
  on public.invitations_equipe for select to authenticated
  using (equipe_id = public.mon_equipe() and public.mon_role() = 'admin');
-- Aucune règle d'ajout / modification / suppression directe sur ces 3 tables :
-- tout passe par les fonctions de la partie 4, qui vérifient les droits.

-- Diagnostics : les règles « propriétaire » du fichier 01 restent en place. On AJOUTE :
drop policy if exists "Équipe : lecture des diagnostics partagés" on public.diagnostics;
create policy "Équipe : lecture des diagnostics partagés"
  on public.diagnostics for select to authenticated
  using (partage_equipe and user_id <> (select auth.uid()) and public.meme_equipe(user_id));

drop policy if exists "Équipe : l'Admin modifie les diagnostics partagés" on public.diagnostics;
create policy "Équipe : l'Admin modifie les diagnostics partagés"
  on public.diagnostics for update to authenticated
  using (partage_equipe and public.admin_equipe_de(user_id))
  with check (partage_equipe and public.admin_equipe_de(user_id));

-- Règle « restrictive » (elle s'ajoute aux autres) : un Viewer ne crée pas de diagnostic
drop policy if exists "Équipe : un Viewer ne crée pas de diagnostic" on public.diagnostics;
create policy "Équipe : un Viewer ne crée pas de diagnostic"
  on public.diagnostics as restrictive for insert to authenticated
  with check (coalesce(public.mon_role(), '') <> 'viewer');

-- L'auteur d'un diagnostic ne peut jamais être changé (même par un Admin)
create or replace function public.bloquer_changement_auteur()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'AUTEUR_FIXE';
  end if;
  return new;
end;
$$;
drop trigger if exists diagnostics_auteur_fixe on public.diagnostics;
create trigger diagnostics_auteur_fixe
  before update of user_id on public.diagnostics
  for each row execute function public.bloquer_changement_auteur();


-- 4) Les actions (appelées par l'application) ------------------------------
-- Les messages d'erreur sont des codes (ex. PLACES_EPUISEES) traduits en français par l'application.

-- Résumé de mon équipe : nom, mon rôle, places, essai / licence
drop function if exists public.mon_equipe_resume();
create function public.mon_equipe_resume()
returns table (
  id uuid, nom text, mon_role text, places_max integer, places_utilisees integer, places_reservees integer,
  viewers integer, invitations_en_attente integer, essai_jusqu_au timestamptz, licence_active boolean,
  licence_jusqu_au timestamptz, active boolean
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.nom, m.role, e.places_max,
         (select count(*)::int from public.membres_equipe x where x.equipe_id = e.id and x.role in ('admin', 'consultant')),
         -- places « réservées » par des invitations Admin/Consultant pas encore acceptées
         (select count(*)::int from public.invitations_equipe i
           where i.equipe_id = e.id and i.acceptee_at is null and i.expires_at > now() and i.role in ('admin', 'consultant')),
         (select count(*)::int from public.membres_equipe x where x.equipe_id = e.id and x.role = 'viewer'),
         (select count(*)::int from public.invitations_equipe i
           where i.equipe_id = e.id and i.acceptee_at is null and i.expires_at > now()),
         e.essai_jusqu_au, e.licence_active, e.licence_jusqu_au, public.equipe_active(e.id)
    from public.membres_equipe m
    join public.equipes e on e.id = m.equipe_id
   where m.user_id = auth.uid()
$$;

-- Liste des membres de mon équipe (avec leur nom)
create or replace function public.membres_de_mon_equipe()
returns table (user_id uuid, email text, nom text, role text, created_at timestamptz, est_moi boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.email,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nom_complet'), ''), split_part(coalesce(m.email, ''), '@', 1)),
         m.role, m.created_at, m.user_id = auth.uid()
    from public.membres_equipe m
    left join auth.users u on u.id = m.user_id
   where m.equipe_id = public.mon_equipe()
   order by case m.role when 'admin' then 0 when 'consultant' then 1 else 2 end, m.created_at
$$;

-- Créer mon équipe : j'en deviens l'Admin. Essai gratuit de 14 jours.
create or replace function public.creer_equipe(p_nom text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'NON_CONNECTE'; end if;
  if exists (select 1 from public.membres_equipe m where m.user_id = v_uid) then raise exception 'DEJA_DANS_EQUIPE'; end if;
  if char_length(btrim(coalesce(p_nom, ''))) not between 1 and 120 then raise exception 'NOM_INVALIDE'; end if;

  -- Si j'avais déjà créé une équipe (aujourd'hui vide), je la reprends : pas de 2e essai gratuit
  select e.id into v_id
    from public.equipes e
   where e.proprietaire_id = v_uid
     and not exists (select 1 from public.membres_equipe x where x.equipe_id = e.id)
   order by e.created_at desc limit 1;

  if v_id is null then
    insert into public.equipes (nom, proprietaire_id) values (btrim(p_nom), v_uid) returning id into v_id;
  else
    update public.equipes set nom = btrim(p_nom) where id = v_id;
  end if;

  insert into public.membres_equipe (equipe_id, user_id, role, email)
  values (v_id, v_uid, 'admin', (select lower(u.email) from auth.users u where u.id = v_uid));
  return v_id;
end;
$$;

-- Renommer l'équipe (Admin)
create or replace function public.renommer_equipe(p_nom text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_equipe uuid;
begin
  select m.equipe_id into v_equipe from public.membres_equipe m where m.user_id = auth.uid() and m.role = 'admin';
  if v_equipe is null then raise exception 'PAS_ADMIN'; end if;
  if char_length(btrim(coalesce(p_nom, ''))) not between 1 and 120 then raise exception 'NOM_INVALIDE'; end if;
  update public.equipes set nom = btrim(p_nom) where id = v_equipe;
end;
$$;

-- Inviter quelqu'un (Admin). Renvoie le jeton secret du lien d'invitation.
create or replace function public.inviter_membre(p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_equipe    uuid;
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_jeton     uuid;
  v_places    integer;
  v_utilisees integer;
begin
  select m.equipe_id into v_equipe from public.membres_equipe m where m.user_id = v_uid and m.role = 'admin';
  if v_equipe is null then raise exception 'PAS_ADMIN'; end if;
  if not public.equipe_active(v_equipe) then raise exception 'LICENCE_INACTIVE'; end if;
  if coalesce(p_role, '') not in ('admin', 'consultant', 'viewer') then raise exception 'ROLE_INVALIDE'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 200 then
    raise exception 'EMAIL_INVALIDE';
  end if;
  if exists (select 1 from public.membres_equipe m where m.equipe_id = v_equipe and lower(m.email) = v_email) then
    raise exception 'DEJA_MEMBRE';
  end if;

  -- Places : Admin + Consultants (membres + invitations en attente). Les Viewers sont gratuits.
  if p_role in ('admin', 'consultant') then
    select e.places_max into v_places from public.equipes e where e.id = v_equipe;
    select (select count(*) from public.membres_equipe m
             where m.equipe_id = v_equipe and m.role in ('admin', 'consultant'))
         + (select count(*) from public.invitations_equipe i
             where i.equipe_id = v_equipe and i.acceptee_at is null and i.expires_at > now()
               and i.role in ('admin', 'consultant') and lower(i.email) <> v_email)
      into v_utilisees;
    if v_utilisees >= v_places then raise exception 'PLACES_EPUISEES'; end if;
  end if;

  -- Déjà invité ? On met à jour l'invitation (rôle, +7 jours) au lieu d'en créer une 2e
  update public.invitations_equipe i
     set role = p_role, expires_at = now() + interval '7 days', invite_par = v_uid
   where i.equipe_id = v_equipe and lower(i.email) = v_email and i.acceptee_at is null
  returning i.jeton into v_jeton;

  if v_jeton is null then
    insert into public.invitations_equipe (equipe_id, email, role, invite_par)
    values (v_equipe, v_email, p_role, v_uid)
    returning jeton into v_jeton;
  end if;
  return v_jeton;
end;
$$;

-- Annuler une invitation en attente (Admin)
create or replace function public.annuler_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.invitations_equipe i
   where i.id = p_id
     and i.acceptee_at is null
     and i.equipe_id = (select m.equipe_id from public.membres_equipe m where m.user_id = auth.uid() and m.role = 'admin');
  if not found then raise exception 'INVITATION_INTROUVABLE'; end if;
end;
$$;

-- Page d'invitation : ce que la personne invitée a le droit de voir (avec le jeton secret)
create or replace function public.voir_invitation(p_jeton uuid)
returns table (
  equipe_nom text, role text, email text, invite_par_nom text,
  expiree boolean, deja_acceptee boolean, email_correspond boolean, deja_dans_une_equipe boolean
)
language sql stable security definer set search_path = '' as $$
  select e.nom, i.role, i.email,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nom_complet'), ''), u.email, 'Un membre de l’équipe'),
         i.expires_at <= now(),
         i.acceptee_at is not null,
         lower(coalesce((select x.email from auth.users x where x.id = auth.uid()), '')) = lower(i.email),
         exists (select 1 from public.membres_equipe m where m.user_id = auth.uid())
    from public.invitations_equipe i
    join public.equipes e on e.id = i.equipe_id
    left join auth.users u on u.id = i.invite_par
   where i.jeton = p_jeton
$$;

-- Accepter une invitation (la personne connectée doit avoir le MÊME email que l'invitation)
create or replace function public.accepter_invitation(p_jeton uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_inv       public.invitations_equipe%rowtype;
  v_places    integer;
  v_utilisees integer;
begin
  if v_uid is null then raise exception 'NON_CONNECTE'; end if;
  select * into v_inv from public.invitations_equipe i where i.jeton = p_jeton for update;
  if not found then raise exception 'INVITATION_INTROUVABLE'; end if;
  if v_inv.acceptee_at is not null then raise exception 'DEJA_ACCEPTEE'; end if;
  if v_inv.expires_at <= now() then raise exception 'INVITATION_EXPIREE'; end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is distinct from lower(v_inv.email) then raise exception 'MAUVAIS_EMAIL'; end if;
  if exists (select 1 from public.membres_equipe m where m.user_id = v_uid) then raise exception 'DEJA_DANS_EQUIPE'; end if;
  if not public.equipe_active(v_inv.equipe_id) then raise exception 'LICENCE_INACTIVE'; end if;

  if v_inv.role in ('admin', 'consultant') then
    -- "for update" : si deux personnes acceptent en même temps, elles passent l'une après l'autre
    select e.places_max into v_places from public.equipes e where e.id = v_inv.equipe_id for update;
    select count(*) into v_utilisees from public.membres_equipe m
     where m.equipe_id = v_inv.equipe_id and m.role in ('admin', 'consultant');
    if v_utilisees >= v_places then raise exception 'PLACES_EPUISEES'; end if;
  end if;

  insert into public.membres_equipe (equipe_id, user_id, role, email) values (v_inv.equipe_id, v_uid, v_inv.role, v_email);
  update public.invitations_equipe set acceptee_at = now(), acceptee_par = v_uid where id = v_inv.id;
  return v_inv.equipe_id;
end;
$$;

-- Changer le rôle d'un membre (Admin)
create or replace function public.changer_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_equipe    uuid;
  v_ancien    text;
  v_places    integer;
  v_utilisees integer;
begin
  select m.equipe_id into v_equipe from public.membres_equipe m where m.user_id = auth.uid() and m.role = 'admin';
  if v_equipe is null then raise exception 'PAS_ADMIN'; end if;
  if coalesce(p_role, '') not in ('admin', 'consultant', 'viewer') then raise exception 'ROLE_INVALIDE'; end if;

  -- On verrouille l'équipe pour éviter deux changements en même temps
  select e.places_max into v_places from public.equipes e where e.id = v_equipe for update;
  select m.role into v_ancien from public.membres_equipe m where m.equipe_id = v_equipe and m.user_id = p_user;
  if v_ancien is null then raise exception 'MEMBRE_INTROUVABLE'; end if;
  if v_ancien = p_role then return; end if;

  -- Il doit toujours rester au moins un Admin
  if v_ancien = 'admin'
     and (select count(*) from public.membres_equipe m where m.equipe_id = v_equipe and m.role = 'admin') <= 1 then
    raise exception 'DERNIER_ADMIN';
  end if;

  -- Un Viewer qui devient Admin ou Consultant prend une place (invitations en attente comprises)
  if v_ancien = 'viewer' then
    if not public.equipe_active(v_equipe) then raise exception 'LICENCE_INACTIVE'; end if;
    select (select count(*) from public.membres_equipe m
             where m.equipe_id = v_equipe and m.role in ('admin', 'consultant'))
         + (select count(*) from public.invitations_equipe i
             where i.equipe_id = v_equipe and i.acceptee_at is null and i.expires_at > now()
               and i.role in ('admin', 'consultant'))
      into v_utilisees;
    if v_utilisees >= v_places then raise exception 'PLACES_EPUISEES'; end if;
  end if;

  update public.membres_equipe set role = p_role where equipe_id = v_equipe and user_id = p_user;
end;
$$;

-- Retirer un membre (Admin) ou quitter l'équipe soi-même
create or replace function public.retirer_membre(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_equipe     uuid;
  v_mon_role   text;
  v_role_cible text;
begin
  select m.equipe_id, m.role into v_equipe, v_mon_role from public.membres_equipe m where m.user_id = v_uid;
  if v_equipe is null then raise exception 'PAS_DANS_EQUIPE'; end if;
  if p_user is distinct from v_uid and v_mon_role <> 'admin' then raise exception 'PAS_ADMIN'; end if;

  perform 1 from public.equipes e where e.id = v_equipe for update;
  select m.role into v_role_cible from public.membres_equipe m where m.equipe_id = v_equipe and m.user_id = p_user;
  if v_role_cible is null then raise exception 'MEMBRE_INTROUVABLE'; end if;

  -- Le dernier Admin ne peut pas partir tant qu'il reste d'autres membres
  if v_role_cible = 'admin'
     and (select count(*) from public.membres_equipe m where m.equipe_id = v_equipe and m.role = 'admin') <= 1
     and (select count(*) from public.membres_equipe m where m.equipe_id = v_equipe) > 1 then
    raise exception 'DERNIER_ADMIN';
  end if;

  delete from public.membres_equipe where equipe_id = v_equipe and user_id = p_user;
  -- Ses diagnostics restent à lui, mais ne sont plus partagés
  update public.diagnostics set partage_equipe = false where user_id = p_user and partage_equipe;
  -- Équipe vide : on supprime les invitations en attente
  if not exists (select 1 from public.membres_equipe m where m.equipe_id = v_equipe) then
    delete from public.invitations_equipe where equipe_id = v_equipe and acceptee_at is null;
  end if;
end;
$$;


-- 5) Qui a le droit d'appeler ces fonctions ----------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.equipe_active(uuid)', 'public.mon_equipe()', 'public.mon_role()',
    'public.meme_equipe(uuid)', 'public.admin_equipe_de(uuid)',
    'public.mon_equipe_resume()', 'public.membres_de_mon_equipe()', 'public.creer_equipe(text)',
    'public.renommer_equipe(text)', 'public.inviter_membre(text, text)', 'public.annuler_invitation(uuid)',
    'public.voir_invitation(uuid)', 'public.accepter_invitation(uuid)', 'public.changer_role(uuid, text)',
    'public.retirer_membre(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- La page d'invitation peut afficher le nom de l'équipe avant la connexion
grant execute on function public.voir_invitation(uuid) to anon;


-- 6) Vérification : doit afficher 3 lignes avec "true"
select tablename, rowsecurity from pg_tables
 where tablename in ('equipes', 'membres_equipe', 'invitations_equipe') order by tablename;


-- =====================================================================
-- 💡 POUR TOI (le vendeur de l'outil) : activer une licence payée à la main
--    Remplace le nom de l'équipe, enlève les 2 tirets "--" devant la ligne, puis "Run".
-- update public.equipes set licence_active = true, licence_jusqu_au = now() + interval '1 month' where nom = 'Nom de l''équipe';
--
--    Donner plus de places (ex. 10) :
-- update public.equipes set places_max = 10 where nom = 'Nom de l''équipe';
-- =====================================================================
