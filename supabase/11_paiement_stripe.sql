-- =====================================================================
-- Diagnostic IA — PAIEMENT STRIPE de l'offre Équipe
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- À exécuter APRÈS supabase/07_equipes.sql.
--
-- Comment ça marche :
--   1. L'Admin clique « 💳 Payer avec Stripe » et paie sur la page sécurisée de Stripe.
--   2. Stripe prévient notre serveur (le « webhook »).
--   3. Le serveur appelle stripe_appliquer_abonnement() : la licence de l'équipe s'active,
--      se prolonge chaque mois, ou s'arrête si le client résilie ou ne paie plus.
-- 🔒 Seul le SERVEUR (avec la clé secrète Supabase) peut écrire ici :
--    personne ne peut activer sa licence tout seul depuis son navigateur.
-- =====================================================================

-- 1) La table : un abonnement Stripe par équipe --------------------------
create table if not exists public.abonnements_stripe (
  equipe_id               uuid primary key references public.equipes (id) on delete cascade,
  stripe_customer_id      text unique,            -- le client chez Stripe (cus_…)
  stripe_subscription_id  text unique,            -- l'abonnement chez Stripe (sub_…)
  statut                  text,                   -- trialing, active, past_due, canceled, unpaid, incomplete…
  fin_periode             timestamptz,            -- prochain prélèvement (ou fin, si résiliation prévue)
  annulation_prevue       boolean not null default false,
  mis_a_jour_le           timestamptz not null default now()
);

-- Sécurité : seul l'Admin de l'équipe peut LIRE son abonnement ; personne ne l'écrit depuis le navigateur
alter table public.abonnements_stripe enable row level security;

drop policy if exists "Abonnement : lecture par l'Admin" on public.abonnements_stripe;
create policy "Abonnement : lecture par l'Admin"
  on public.abonnements_stripe for select to authenticated
  using (equipe_id = public.mon_equipe() and public.mon_role() = 'admin');

revoke insert, update, delete, truncate on public.abonnements_stripe from anon, authenticated;


-- 2) Les fonctions réservées au serveur -----------------------------------
-- Retenir le client Stripe d'une équipe (appelée juste avant d'ouvrir la page de paiement)
create or replace function public.stripe_enregistrer_client(p_equipe uuid, p_customer text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.equipes e where e.id = p_equipe) then raise exception 'EQUIPE_INTROUVABLE'; end if;
  if coalesce(p_customer, '') !~ '^cus_[A-Za-z0-9]+$' then raise exception 'CLIENT_INVALIDE'; end if;
  insert into public.abonnements_stripe (equipe_id, stripe_customer_id)
  values (p_equipe, p_customer)
  on conflict (equipe_id) do update
    set stripe_customer_id = excluded.stripe_customer_id, mis_a_jour_le = now();
end;
$$;

-- Appliquer l'état d'un abonnement Stripe à la licence de l'équipe
--   trialing / active → licence active jusqu'à la fin de la période + 3 jours de marge
--   past_due (paiement refusé, Stripe réessaie) → on garde l'accès jusqu'à la date déjà prévue
--   canceled / unpaid / incomplete_expired / paused → licence arrêtée (l'essai gratuit n'est pas touché)
--   incomplete (paiement pas encore confirmé) → rien ne change
create or replace function public.stripe_appliquer_abonnement(
  p_equipe uuid, p_customer text, p_subscription text, p_statut text, p_fin timestamptz, p_annulation boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actuel public.abonnements_stripe%rowtype;
begin
  if not exists (select 1 from public.equipes e where e.id = p_equipe) then raise exception 'EQUIPE_INTROUVABLE'; end if;
  if coalesce(p_subscription, '') !~ '^sub_[A-Za-z0-9]+$' then raise exception 'ABONNEMENT_INVALIDE'; end if;

  -- Une seule mise à jour à la fois pour cette équipe (Stripe peut envoyer 2 messages en même temps)
  perform 1 from public.equipes e where e.id = p_equipe for update;
  select * into v_actuel from public.abonnements_stripe a where a.equipe_id = p_equipe;

  -- Un ANCIEN abonnement terminé ne doit pas couper un NOUVEL abonnement en cours
  if v_actuel.stripe_subscription_id is not null
     and v_actuel.stripe_subscription_id <> p_subscription
     and v_actuel.statut in ('active', 'trialing', 'past_due')
     and p_statut not in ('active', 'trialing', 'past_due') then
    return;
  end if;

  insert into public.abonnements_stripe as a
    (equipe_id, stripe_customer_id, stripe_subscription_id, statut, fin_periode, annulation_prevue, mis_a_jour_le)
  values (p_equipe, p_customer, p_subscription, p_statut, p_fin, coalesce(p_annulation, false), now())
  on conflict (equipe_id) do update
    set stripe_customer_id     = coalesce(excluded.stripe_customer_id, a.stripe_customer_id),
        stripe_subscription_id = excluded.stripe_subscription_id,
        statut                 = excluded.statut,
        fin_periode            = excluded.fin_periode,
        annulation_prevue      = excluded.annulation_prevue,
        mis_a_jour_le          = now();

  if p_statut in ('active', 'trialing') then
    update public.equipes
       set licence_active = true,
           licence_jusqu_au = coalesce(p_fin, now() + interval '1 month') + interval '3 days'
     where id = p_equipe;
  elsif p_statut = 'past_due' then
    update public.equipes
       set licence_active = true,
           licence_jusqu_au = coalesce(licence_jusqu_au, now() + interval '3 days')
     where id = p_equipe;
  elsif p_statut in ('canceled', 'unpaid', 'incomplete_expired', 'paused') then
    update public.equipes set licence_active = false where id = p_equipe;
  end if;
end;
$$;

revoke all on function public.stripe_enregistrer_client(uuid, text) from public, anon, authenticated;
revoke all on function public.stripe_appliquer_abonnement(uuid, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.stripe_enregistrer_client(uuid, text) to service_role;
grant execute on function public.stripe_appliquer_abonnement(uuid, text, text, text, timestamptz, boolean) to service_role;


-- 3) Protection : on ne peut pas vider une équipe qui paie encore --------------
-- Sinon l'abonnement continuerait d'être prélevé sans personne pour le résilier.
-- (Concerne « Quitter l'équipe » et « Supprimer mon compte » pour la DERNIÈRE personne de l'équipe.)
create or replace function public.bloquer_depart_si_abonnement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membres_equipe m where m.equipe_id = old.equipe_id and m.user_id <> old.user_id)
     and exists (select 1 from public.abonnements_stripe a
                  where a.equipe_id = old.equipe_id
                    and a.statut in ('active', 'trialing', 'past_due')
                    and not a.annulation_prevue) then
    raise exception 'ABONNEMENT_ACTIF';
  end if;
  return old;
end;
$$;
drop trigger if exists membres_equipe_abonnement_actif on public.membres_equipe;
create trigger membres_equipe_abonnement_actif
  before delete on public.membres_equipe
  for each row execute function public.bloquer_depart_si_abonnement();


-- 4) Vérification : doit afficher "abonnements_stripe | true"
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'abonnements_stripe';
