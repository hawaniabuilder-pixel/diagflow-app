-- =====================================================================
-- Diagnostic IA — NOTIFICATIONS dans l'application (la cloche 🔔)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- 💡 Si vous exécutez 07_equipes.sql APRÈS ce fichier, relancez ce fichier ensuite
--    (pour activer les notifications d'équipe).
-- =====================================================================

-- 1) La table ----------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade, -- destinataire
  type        text not null default 'info' check (type in ('succes', 'erreur', 'info')),   -- vert / rouge / bleu
  titre       text not null check (char_length(titre) between 1 and 150),
  message     text check (message is null or char_length(message) <= 1000),
  -- Page à ouvrir au clic : seulement une page de l'application (commence par "/", jamais "//")
  lien        text check (lien is null or (char_length(lien) <= 500 and left(lien, 1) = '/' and left(lien, 2) <> '//')),
  lue         boolean not null default false,
  lue_at      timestamptz,
  created_at  timestamptz not null default now()
);

-- Affichage rapide : « mes notifications, les plus récentes d'abord » et « combien de non lues »
create index if not exists notifications_user_recentes_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_non_lues_idx on public.notifications (user_id) where not lue;

-- Date de lecture remplie automatiquement
create or replace function public.notifications_date_lecture()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lue and not old.lue then new.lue_at = now(); end if;
  if not new.lue then new.lue_at = null; end if;
  return new;
end;
$$;
drop trigger if exists notifications_date_lecture on public.notifications;
create trigger notifications_date_lecture
  before update of lue on public.notifications
  for each row execute function public.notifications_date_lecture();


-- 2) Sécurité : chacun ne voit et ne gère QUE ses notifications ---------
alter table public.notifications enable row level security;

drop policy if exists "Notifications : lecture des siennes"      on public.notifications;
drop policy if exists "Notifications : création pour soi"       on public.notifications;
drop policy if exists "Notifications : marquer les siennes lues" on public.notifications;
drop policy if exists "Notifications : suppression des siennes"  on public.notifications;

create policy "Notifications : lecture des siennes"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Notifications : création pour soi"
  on public.notifications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Notifications : marquer les siennes lues"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Notifications : suppression des siennes"
  on public.notifications for delete to authenticated
  using ((select auth.uid()) = user_id);

-- On ne peut modifier QUE les colonnes "lue" et "lue_at" (pas le titre, ni le destinataire)
revoke all on public.notifications from anon;
revoke update on public.notifications from authenticated;
grant update (lue, lue_at) on public.notifications to authenticated;


-- 3) Mise à jour en direct (la cloche se met à jour sans recharger la page) ----
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;


-- 4) Notifications AUTOMATIQUES (créées par la base, même si vous avez quitté la page) ----

-- a) L'analyse (IA ou démo) est terminée
create or replace function public.notifier_analyse_terminee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.diagnostic_ia_original is not null and new.diagnostic_ia_original is distinct from old.diagnostic_ia_original then
    insert into public.notifications (user_id, type, titre, message, lien)
    values (new.user_id, 'succes',
            left('✅ Analyse terminée — ' || new.entreprise, 150),
            'Le diagnostic est prêt. Relisez-le et personnalisez-le avant de l’envoyer au client.',
            '/diagnostic/' || new.id || '/relecture');
  end if;
  return new;
end;
$$;
drop trigger if exists diagnostics_notif_analyse on public.diagnostics;
create trigger diagnostics_notif_analyse
  after update of diagnostic_ia_original on public.diagnostics
  for each row execute function public.notifier_analyse_terminee();

-- b) Le client a ouvert son rapport pour la première fois (les aperçus du consultant ne comptent pas)
create or replace function public.notifier_rapport_ouvert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.vu_par_client and not coalesce(old.vu_par_client, false) then
    insert into public.notifications (user_id, type, titre, message, lien)
    values (new.user_id, 'succes',
            left('👀 ' || new.entreprise || ' a ouvert son rapport', 150),
            'Le client vient de lire votre diagnostic : c’est le bon moment pour prendre de ses nouvelles.',
            '/diagnostic?id=' || new.id || '#envoi');
  end if;
  return new;
end;
$$;
drop trigger if exists diagnostics_notif_ouverture on public.diagnostics;
create trigger diagnostics_notif_ouverture
  after update of vu_par_client on public.diagnostics
  for each row execute function public.notifier_rapport_ouvert();

-- c) ÉQUIPE : quelqu'un rejoint l'équipe → les Admins sont prévenus
create or replace function public.notifier_nouveau_membre()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nom text;
begin
  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nom_complet'), ''), u.email, 'Un nouveau membre')
    into v_nom from auth.users u where u.id = new.user_id;
  insert into public.notifications (user_id, type, titre, message, lien)
  select m.user_id, 'info',
         left('👥 ' || coalesce(v_nom, 'Un nouveau membre') || ' a rejoint l’équipe', 150),
         'Rôle : ' || case new.role when 'admin' then 'Admin' when 'consultant' then 'Consultant' else 'Viewer' end || '.',
         '/dashboard/equipe'
    from public.membres_equipe m
   where m.equipe_id = new.equipe_id and m.role = 'admin' and m.user_id <> new.user_id;
  return new;
end;
$$;

-- d) ÉQUIPE : un diagnostic est partagé → les autres membres sont prévenus
create or replace function public.notifier_partage_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_equipe uuid;
  v_auteur text;
begin
  if not (new.partage_equipe and not coalesce(old.partage_equipe, false)) then return new; end if;
  select m.equipe_id into v_equipe from public.membres_equipe m where m.user_id = new.user_id;
  if v_equipe is null or not public.equipe_active(v_equipe) then return new; end if;
  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nom_complet'), ''), u.email, 'Un collègue')
    into v_auteur from auth.users u where u.id = new.user_id;
  insert into public.notifications (user_id, type, titre, message, lien)
  select m.user_id, 'info',
         left('📄 ' || coalesce(v_auteur, 'Un collègue') || ' a partagé « ' || new.entreprise || ' »', 150),
         'Un nouveau diagnostic est disponible dans « Partagés par votre équipe ».',
         '/diagnostic/' || new.id || '/voir'
    from public.membres_equipe m
   where m.equipe_id = v_equipe and m.user_id <> new.user_id;
  return new;
end;
$$;

-- Les déclencheurs d'équipe ne sont créés que si l'offre Équipe (fichier 07) est installée
do $$
begin
  if to_regclass('public.membres_equipe') is not null then
    execute 'drop trigger if exists membres_notif_arrivee on public.membres_equipe';
    execute 'create trigger membres_notif_arrivee after insert on public.membres_equipe
             for each row execute function public.notifier_nouveau_membre()';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'diagnostics' and column_name = 'partage_equipe') then
    execute 'drop trigger if exists diagnostics_notif_partage on public.diagnostics';
    execute 'create trigger diagnostics_notif_partage after update of partage_equipe on public.diagnostics
             for each row execute function public.notifier_partage_equipe()';
  end if;
end $$;

-- Ces fonctions ne sont pas appelables directement (seulement par les déclencheurs)
revoke all on function public.notifier_analyse_terminee() from public, anon, authenticated;
revoke all on function public.notifier_rapport_ouvert()   from public, anon, authenticated;
revoke all on function public.notifier_nouveau_membre()   from public, anon, authenticated;
revoke all on function public.notifier_partage_equipe()   from public, anon, authenticated;


-- 5) Vérification : doit afficher "notifications | true"
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'notifications';
