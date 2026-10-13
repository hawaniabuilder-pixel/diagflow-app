-- =====================================================================
-- Diagnostic IA — QUOTA d'analyses IA + SUPPRESSION de compte (RGPD)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
--
-- Pourquoi un quota ? Chaque analyse IA vous coûte de l'argent chez Anthropic.
-- Par défaut : 30 analyses par mois et par compte, et 5 maximum en 10 minutes.
-- (Le 🧪 Mode Démo ne compte pas : il n'appelle pas l'IA.)
-- =====================================================================

-- 1) Le « compteur » : une ligne par analyse IA lancée ------------------
create table if not exists public.utilisation_ia (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  template    text,
  created_at  timestamptz not null default now()
);
create index if not exists utilisation_ia_user_date_idx on public.utilisation_ia (user_id, created_at desc);

-- Quotas personnalisés (ex. un client qui paie plus) : à remplir à la main, voir en bas du fichier
create table if not exists public.quotas_ia (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  quota_mensuel  integer not null check (quota_mensuel between 0 and 10000),
  note           text
);

-- Sécurité : chacun peut LIRE son compteur, personne ne peut le modifier lui-même
alter table public.utilisation_ia enable row level security;
alter table public.quotas_ia      enable row level security;

drop policy if exists "Utilisation IA : lecture de la sienne" on public.utilisation_ia;
create policy "Utilisation IA : lecture de la sienne"
  on public.utilisation_ia for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Quota IA : lecture du sien" on public.quotas_ia;
create policy "Quota IA : lecture du sien"
  on public.quotas_ia for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.utilisation_ia from anon, authenticated;
revoke insert, update, delete on public.quotas_ia      from anon, authenticated;


-- 2) Les fonctions --------------------------------------------------------
-- Quota d'une personne : 30 par mois, sauf quota personnalisé
create or replace function public.quota_ia_de(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select q.quota_mensuel from public.quotas_ia q where q.user_id = p_user), 30)
$$;

-- Mon compteur du mois (affiché dans Paramètres)
create or replace function public.mon_utilisation_ia()
returns table (utilisees integer, quota integer, restantes integer, renouvellement timestamptz)
language sql stable security definer set search_path = '' as $$
  with u as (
    select count(*)::int as n from public.utilisation_ia
     where user_id = auth.uid() and created_at >= date_trunc('month', now())
  )
  select u.n, public.quota_ia_de(auth.uid()), greatest(0, public.quota_ia_de(auth.uid()) - u.n),
         date_trunc('month', now()) + interval '1 month'
    from u
$$;

-- Appelée par l'API AVANT d'interroger l'IA : vérifie le quota et compte l'analyse.
-- Renvoie un numéro de « ticket » (pour rembourser si l'IA échoue).
create or replace function public.consommer_analyse_ia(p_template text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'NON_CONNECTE'; end if;
  -- Une seule vérification à la fois par personne (évite de dépasser en cliquant 10 fois très vite)
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if (select count(*) from public.utilisation_ia
       where user_id = v_uid and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'TROP_RAPIDE';
  end if;
  if (select count(*) from public.utilisation_ia
       where user_id = v_uid and created_at >= date_trunc('month', now())) >= public.quota_ia_de(v_uid) then
    raise exception 'QUOTA_ATTEINT';
  end if;

  insert into public.utilisation_ia (user_id, template) values (v_uid, left(p_template, 20)) returning id into v_id;
  return v_id;
end;
$$;

-- L'IA a échoué : on rend l'analyse (seulement son propre ticket, et dans l'heure)
create or replace function public.rembourser_analyse_ia(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.utilisation_ia
   where id = p_id and user_id = auth.uid() and created_at > now() - interval '1 hour'
$$;


-- 3) Supprimer mon compte (droit à l'effacement, RGPD) --------------------
-- Efface le compte et, en cascade, tous ses diagnostics, clients, paramètres, notifications…
-- (Le logo est effacé juste avant par l'application.)
create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid          uuid := auth.uid();
  v_role         text;
  v_autres       integer := 0;
  v_autres_admin integer := 0;
begin
  if v_uid is null then raise exception 'NON_CONNECTE'; end if;

  -- Offre Équipe (si installée) : le dernier Admin doit d'abord nommer un autre Admin
  if to_regclass('public.membres_equipe') is not null then
    execute 'select role from public.membres_equipe where user_id = $1' into v_role using v_uid;
    if v_role = 'admin' then
      execute 'select count(*), count(*) filter (where m.role = ''admin'')
                 from public.membres_equipe m
                where m.equipe_id = (select x.equipe_id from public.membres_equipe x where x.user_id = $1)
                  and m.user_id <> $1'
        into v_autres, v_autres_admin using v_uid;
      if v_autres > 0 and v_autres_admin = 0 then raise exception 'DERNIER_ADMIN'; end if;
    end if;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;


-- 4) Qui peut appeler quoi -----------------------------------------------
revoke all on function public.quota_ia_de(uuid)                from public, anon, authenticated;
revoke all on function public.mon_utilisation_ia()             from public, anon;
revoke all on function public.consommer_analyse_ia(text)       from public, anon;
revoke all on function public.rembourser_analyse_ia(uuid)      from public, anon;
revoke all on function public.supprimer_mon_compte()           from public, anon;
grant execute on function public.mon_utilisation_ia()          to authenticated;
grant execute on function public.consommer_analyse_ia(text)    to authenticated;
grant execute on function public.rembourser_analyse_ia(uuid)   to authenticated;
grant execute on function public.supprimer_mon_compte()        to authenticated;


-- 5) Vérification : doit afficher 2 lignes avec "true"
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' and tablename in ('utilisation_ia', 'quotas_ia') order by tablename;


-- =====================================================================
-- 💡 POUR TOI : donner un quota différent à un client (ex. 100 analyses par mois)
--    Remplace l'email, enlève les 2 tirets "--" devant les 3 lignes, puis "Run".
-- insert into public.quotas_ia (user_id, quota_mensuel, note)
-- select id, 100, 'Offre Équipe' from auth.users where email = 'client@exemple.fr'
-- on conflict (user_id) do update set quota_mensuel = excluded.quota_mensuel, note = excluded.note;
-- =====================================================================
