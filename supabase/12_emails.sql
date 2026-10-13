-- =====================================================================
-- Diagnostic IA — EMAILS AUTOMATIQUES (bienvenue, fin d'essai de l'offre Équipe)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- À exécuter APRÈS supabase/07_equipes.sql et supabase/11_paiement_stripe.sql.
--
-- Le « journal » garde une trace de chaque email automatique envoyé :
-- grâce à lui, personne ne reçoit 2 fois le même email.
-- 🔒 Seul le SERVEUR (clé secrète Supabase) lit et écrit ici.
-- =====================================================================

-- 1) Le journal des emails ----------------------------------------------
create table if not exists public.emails_envoyes (
  id            uuid primary key default gen_random_uuid(),
  cle           text not null unique,        -- ex. « bienvenue:<id du compte> », « fin_essai_j3:<id de l'équipe> »
  type          text not null,               -- bienvenue, fin_essai_j3, fin_essai_j0
  destinataire  text,
  user_id       uuid references auth.users (id) on delete cascade,
  equipe_id     uuid references public.equipes (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index if not exists emails_envoyes_user_idx on public.emails_envoyes (user_id);

-- Sécurité : aucune règle de lecture = personne ne le voit depuis le navigateur
alter table public.emails_envoyes enable row level security;
revoke all on public.emails_envoyes from anon, authenticated;


-- 2) Les fonctions réservées au serveur -----------------------------------
-- « Réserver » un email avant de l'envoyer : renvoie true la 1re fois, false s'il est déjà parti
create or replace function public.reserver_email(
  p_cle text, p_type text, p_destinataire text, p_user uuid default null, p_equipe uuid default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.emails_envoyes (cle, type, destinataire, user_id, equipe_id)
  values (p_cle, p_type, p_destinataire, p_user, p_equipe)
  on conflict (cle) do nothing;
  return found;
end;
$$;

-- L'envoi a échoué : on libère la réservation pour réessayer plus tard
create or replace function public.liberer_email(p_cle text)
returns void language sql security definer set search_path = '' as $$
  delete from public.emails_envoyes where cle = p_cle
$$;

-- Les équipes à prévenir de la fin de leur essai gratuit :
--   fin_essai_j3 : l'essai se termine dans moins de 3 jours
--   fin_essai_j0 : l'essai est terminé depuis moins de 3 jours
-- Seulement si l'équipe n'a NI licence active NI abonnement Stripe en cours.
create or replace function public.equipes_fin_essai()
returns table (equipe_id uuid, nom text, essai_jusqu_au timestamptz, type text, emails_admins text[])
language sql stable security definer set search_path = '' as $$
  select e.id, e.nom, e.essai_jusqu_au,
         case when e.essai_jusqu_au > now() then 'fin_essai_j3' else 'fin_essai_j0' end,
         array(select m.email from public.membres_equipe m
                where m.equipe_id = e.id and m.role = 'admin' and m.email is not null order by m.created_at)
    from public.equipes e
   where e.essai_jusqu_au between now() - interval '3 days' and now() + interval '3 days'
     and not (e.licence_active and (e.licence_jusqu_au is null or e.licence_jusqu_au > now()))
     and not exists (select 1 from public.abonnements_stripe a
                      where a.equipe_id = e.id and a.statut in ('active', 'trialing', 'past_due'))
     and exists (select 1 from public.membres_equipe m where m.equipe_id = e.id and m.role = 'admin')
$$;

revoke all on function public.reserver_email(text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.liberer_email(text)                          from public, anon, authenticated;
revoke all on function public.equipes_fin_essai()                         from public, anon, authenticated;
grant execute on function public.reserver_email(text, text, text, uuid, uuid) to service_role;
grant execute on function public.liberer_email(text)                          to service_role;
grant execute on function public.equipes_fin_essai()                         to service_role;


-- 3) Vérification : doit afficher "emails_envoyes | true"
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'emails_envoyes';
