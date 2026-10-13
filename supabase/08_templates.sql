-- =====================================================================
-- Diagnostic IA — TEMPLATES de rapport (Express 49 € · Complet 149 € · Premium 299 €)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- 1) Template choisi par défaut dans les Paramètres du consultant
alter table public.profils
  add column if not exists template_defaut text not null default 'complet'
    check (template_defaut in ('express', 'complet', 'premium'));

-- 2) Sur chaque diagnostic : le template utilisé + les points de suivi Premium (à 1, 2 et 3 mois)
alter table public.diagnostics
  add column if not exists template    text check (template is null or template in ('express', 'complet', 'premium')),
  add column if not exists suivi_m1_at timestamptz,  -- point de suivi à 1 mois fait le…
  add column if not exists suivi_m2_at timestamptz,  -- point de suivi à 2 mois fait le…
  add column if not exists suivi_m3_at timestamptz;  -- point de suivi à 3 mois fait le…

-- 3) Les diagnostics déjà analysés deviennent des rapports « Complet » (c'était le seul format jusqu'ici)
update public.diagnostics
   set template = coalesce(nullif(diagnostic_json ->> 'template', ''), 'complet')
 where template is null
   and diagnostic_json is not null;

-- 4) Vérification : doit afficher 5 lignes
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'profils' and column_name = 'template_defaut')
     or (table_name = 'diagnostics' and column_name in ('template', 'suivi_m1_at', 'suivi_m2_at', 'suivi_m3_at')))
 order by table_name, column_name;
