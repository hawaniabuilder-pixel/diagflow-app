-- =====================================================================
-- Diagnostic IA — Suivi commercial (tableau de bord)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Ajoute des colonnes à la table "diagnostics" (aucune donnée n'est supprimée).
-- Le script peut être relancé sans risque.
-- =====================================================================

alter table public.diagnostics
  -- Prix que le consultant facture pour ce diagnostic (HT, en euros)
  add column if not exists prix_diagnostic   numeric(10, 2) check (prix_diagnostic >= 0),
  -- Date du premier envoi au client (sert au "CA du mois")
  add column if not exists envoye_at         timestamptz,
  -- Le client a-t-il confié une mission (suite du diagnostic) ?
  add column if not exists mission_signee    boolean not null default false,
  add column if not exists montant_mission   numeric(10, 2) check (montant_mission >= 0),
  add column if not exists mission_signee_at timestamptz;

-- Pour les diagnostics déjà envoyés avant ce script : on prend la date de dernière modification
update public.diagnostics
   set envoye_at = updated_at
 where statut = 'envoyé' and envoye_at is null;

-- Vérification : doit afficher les 5 nouvelles colonnes
select column_name, data_type
  from information_schema.columns
 where table_name = 'diagnostics'
   and column_name in ('prix_diagnostic', 'envoye_at', 'mission_signee', 'montant_mission', 'mission_signee_at');
