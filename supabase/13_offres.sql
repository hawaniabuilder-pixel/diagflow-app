-- =====================================================================
-- Diagnostic IA — LES OFFRES : Essai gratuit, Solo (29 €/mois), Équipe (99 €/mois)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- À exécuter APRÈS les fichiers 07, 10 et 11.
--
-- Qui a droit à combien d'analyses IA ?
--   • Essai gratuit : 3 analyses offertes (pour toujours) + le Mode Démo illimité
--   • Solo (abonnement Stripe à 29 €/mois)     : 30 analyses par mois
--   • Équipe (licence payée)                    : 30 analyses par mois et par consultant
--     (pendant les 14 jours d'essai de l'équipe, chacun garde ses 3 analyses offertes :
--      le partage et les invitations marchent, mais l'essai ne donne pas plus d'analyses)
--   • Sur mesure (table quotas_ia, à la main)   : le nombre que tu as choisi
-- =====================================================================

-- 1) L'abonnement Solo : un par personne -----------------------------------
create table if not exists public.abonnements_solo (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  statut                  text,          -- trialing, active, past_due, canceled, unpaid, incomplete…
  fin_periode             timestamptz,   -- prochain prélèvement (ou fin, si résiliation prévue)
  annulation_prevue       boolean not null default false,
  mis_a_jour_le           timestamptz not null default now()
);

-- Sécurité : chacun LIT son abonnement ; personne ne l'écrit depuis le navigateur
alter table public.abonnements_solo enable row level security;
drop policy if exists "Abonnement Solo : lecture du sien" on public.abonnements_solo;
create policy "Abonnement Solo : lecture du sien"
  on public.abonnements_solo for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.abonnements_solo from anon, authenticated;


-- 2) Quelle offre a cette personne ? -------------------------------------------
create or replace function public.offre_de(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.quotas_ia q where q.user_id = p_user) then 'sur_mesure'
    when exists (select 1 from public.abonnements_solo s
                  where s.user_id = p_user
                    and s.statut in ('active', 'trialing', 'past_due')
                    and (s.fin_periode is null or s.fin_periode + interval '3 days' > now())) then 'solo'
    -- Équipe : seulement si la licence est PAYÉE (l'essai gratuit de l'équipe ne suffit pas)
    when exists (select 1 from public.membres_equipe m
                   join public.equipes e on e.id = m.equipe_id
                  where m.user_id = p_user and m.role in ('admin', 'consultant')
                    and e.licence_active
                    and (e.licence_jusqu_au is null or e.licence_jusqu_au > now())) then 'equipe'
    else 'essai'
  end
$$;

-- Nombre d'analyses : par mois pour les offres payantes, au total pour l'essai
create or replace function public.quota_ia_de(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case public.offre_de(p_user)
    when 'sur_mesure' then (select q.quota_mensuel from public.quotas_ia q where q.user_id = p_user)
    when 'essai' then 3
    else 30
  end
$$;


-- 3) Mon offre et mon compteur (affichés dans Paramètres) ----------------------
-- (on la recrée car elle renvoie maintenant aussi l'offre)
drop function if exists public.mon_utilisation_ia();
create function public.mon_utilisation_ia()
returns table (offre text, utilisees integer, quota integer, restantes integer, renouvellement timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_offre text := public.offre_de(auth.uid());
  v_quota integer := public.quota_ia_de(auth.uid());
  v_n     integer;
begin
  if v_offre = 'essai' then
    -- Essai : toutes les analyses depuis la création du compte
    select count(*)::int into v_n from public.utilisation_ia where user_id = v_uid;
    return query select v_offre, v_n, v_quota, greatest(0, v_quota - v_n), null::timestamptz;
  else
    select count(*)::int into v_n from public.utilisation_ia
     where user_id = v_uid and created_at >= date_trunc('month', now());
    return query select v_offre, v_n, v_quota, greatest(0, v_quota - v_n), date_trunc('month', now()) + interval '1 month';
  end if;
end;
$$;


-- 4) Avant chaque analyse IA : on vérifie et on compte -----------------------------
create or replace function public.consommer_analyse_ia(p_template text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_offre text;
  v_quota integer;
  v_id    uuid;
begin
  if v_uid is null then raise exception 'NON_CONNECTE'; end if;
  -- Une seule vérification à la fois par personne (évite de dépasser en cliquant 10 fois très vite)
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if (select count(*) from public.utilisation_ia
       where user_id = v_uid and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'TROP_RAPIDE';
  end if;

  v_offre := public.offre_de(v_uid);
  v_quota := public.quota_ia_de(v_uid);
  if v_offre = 'essai' then
    if (select count(*) from public.utilisation_ia where user_id = v_uid) >= v_quota then
      raise exception 'ESSAI_TERMINE';
    end if;
  elsif (select count(*) from public.utilisation_ia
          where user_id = v_uid and created_at >= date_trunc('month', now())) >= v_quota then
    raise exception 'QUOTA_ATTEINT';
  end if;

  insert into public.utilisation_ia (user_id, template) values (v_uid, left(p_template, 20)) returning id into v_id;
  return v_id;
end;
$$;


-- 5) Fonctions réservées au serveur (paiement Stripe de l'offre Solo) ---------------
create or replace function public.stripe_enregistrer_client_solo(p_user uuid, p_customer text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user) then raise exception 'UTILISATEUR_INTROUVABLE'; end if;
  if coalesce(p_customer, '') !~ '^cus_[A-Za-z0-9]+$' then raise exception 'CLIENT_INVALIDE'; end if;
  insert into public.abonnements_solo (user_id, stripe_customer_id) values (p_user, p_customer)
  on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id, mis_a_jour_le = now();
end;
$$;

create or replace function public.stripe_appliquer_abonnement_solo(
  p_user uuid, p_customer text, p_subscription text, p_statut text, p_fin timestamptz, p_annulation boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actuel public.abonnements_solo%rowtype;
begin
  if not exists (select 1 from auth.users u where u.id = p_user) then raise exception 'UTILISATEUR_INTROUVABLE'; end if;
  if coalesce(p_subscription, '') !~ '^sub_[A-Za-z0-9]+$' then raise exception 'ABONNEMENT_INVALIDE'; end if;
  perform pg_advisory_xact_lock(hashtext('solo:' || p_user::text));
  select * into v_actuel from public.abonnements_solo a where a.user_id = p_user;

  -- Un ANCIEN abonnement terminé ne doit pas écraser un NOUVEL abonnement en cours
  if v_actuel.stripe_subscription_id is not null
     and v_actuel.stripe_subscription_id <> p_subscription
     and v_actuel.statut in ('active', 'trialing', 'past_due')
     and p_statut not in ('active', 'trialing', 'past_due') then
    return;
  end if;

  insert into public.abonnements_solo as a
    (user_id, stripe_customer_id, stripe_subscription_id, statut, fin_periode, annulation_prevue, mis_a_jour_le)
  values (p_user, p_customer, p_subscription, p_statut, p_fin, coalesce(p_annulation, false), now())
  on conflict (user_id) do update
    set stripe_customer_id     = coalesce(excluded.stripe_customer_id, a.stripe_customer_id),
        stripe_subscription_id = excluded.stripe_subscription_id,
        statut                 = excluded.statut,
        fin_periode            = excluded.fin_periode,
        annulation_prevue      = excluded.annulation_prevue,
        mis_a_jour_le          = now();
end;
$$;


-- 6) Protection : pas de suppression de compte avec un abonnement Solo encore prélevé
create or replace function public.bloquer_suppression_si_solo_actif()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.statut in ('active', 'trialing', 'past_due') and not old.annulation_prevue then
    raise exception 'ABONNEMENT_ACTIF';
  end if;
  return old;
end;
$$;
drop trigger if exists abonnements_solo_actif on public.abonnements_solo;
create trigger abonnements_solo_actif
  before delete on public.abonnements_solo
  for each row execute function public.bloquer_suppression_si_solo_actif();


-- 7) Qui peut appeler quoi ----------------------------------------------------
revoke all on function public.offre_de(uuid)                        from public, anon, authenticated;
revoke all on function public.quota_ia_de(uuid)                     from public, anon, authenticated;
revoke all on function public.mon_utilisation_ia()                  from public, anon;
revoke all on function public.consommer_analyse_ia(text)            from public, anon;
revoke all on function public.stripe_enregistrer_client_solo(uuid, text) from public, anon, authenticated;
revoke all on function public.stripe_appliquer_abonnement_solo(uuid, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.mon_utilisation_ia()               to authenticated;
grant execute on function public.consommer_analyse_ia(text)         to authenticated;
grant execute on function public.offre_de(uuid)                     to service_role;
grant execute on function public.stripe_enregistrer_client_solo(uuid, text) to service_role;
grant execute on function public.stripe_appliquer_abonnement_solo(uuid, text, text, text, timestamptz, boolean) to service_role;


-- 8) Vérification : doit afficher "abonnements_solo | true"
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'abonnements_solo';
