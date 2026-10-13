-- =====================================================================
-- Diagnostic IA — Relances après envoi (J+3, J+7, J+14)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Ajoute des colonnes à la table "diagnostics" (aucune donnée n'est supprimée).
-- Le script peut être relancé sans risque.
-- =====================================================================

alter table public.diagnostics
  -- Email du client, mémorisé au moment de l'envoi du rapport
  add column if not exists email_client       text check (email_client is null or char_length(email_client) <= 200),
  -- Date à laquelle chaque relance a été faite (vide = pas encore faite)
  add column if not exists relance_j3_at      timestamptz,
  add column if not exists relance_j7_at      timestamptz,
  add column if not exists relance_j14_at     timestamptz,
  -- Vrai si le client ne veut plus être relancé (ou si le consultant arrête)
  add column if not exists relances_stoppees  boolean not null default false;

-- Vérification : doit afficher les 5 nouvelles colonnes
select column_name, data_type
  from information_schema.columns
 where table_name = 'diagnostics'
   and column_name in ('email_client', 'relance_j3_at', 'relance_j7_at', 'relance_j14_at', 'relances_stoppees');
