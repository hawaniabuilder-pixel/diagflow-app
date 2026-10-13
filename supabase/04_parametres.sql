-- =====================================================================
-- Diagnostic IA — Paramètres du consultant (page /settings)
-- À copier-coller en entier dans Supabase > SQL Editor > "Run".
-- Crée : la table "profils", l'espace de stockage des logos,
-- et met à jour la fonction du rapport client (logo, couleur, lien de RDV).
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- 1) Table des profils : une ligne par consultant -----------------------
create table if not exists public.profils (
  id                  uuid primary key default auth.uid()
                        references auth.users (id) on delete cascade,
  nom_complet         text check (char_length(nom_complet) <= 120),
  nom_cabinet         text check (char_length(nom_cabinet) <= 120),
  logo_url            text check (char_length(logo_url) <= 500),
  couleur_principale  text not null default '#2563eb'
                        check (couleur_principale ~ '^#[0-9a-fA-F]{6}$'),
  lien_calendly       text check (lien_calendly is null or (lien_calendly ~* '^https://' and char_length(lien_calendly) <= 300)),
  signature_email     text check (char_length(signature_email) <= 1000),
  taux_horaire_defaut numeric(10, 2) not null default 40
                        check (taux_horaire_defaut >= 0 and taux_horaire_defaut <= 500),
  updated_at          timestamptz not null default now()
);

drop trigger if exists profils_set_updated_at on public.profils;
create trigger profils_set_updated_at
  before update on public.profils
  for each row execute function public.set_updated_at();

alter table public.profils enable row level security;

drop policy if exists "Profil : lecture par son propriétaire"      on public.profils;
drop policy if exists "Profil : création par son propriétaire"     on public.profils;
drop policy if exists "Profil : modification par son propriétaire" on public.profils;

create policy "Profil : lecture par son propriétaire"
  on public.profils for select to authenticated
  using ((select auth.uid()) = id);

create policy "Profil : création par son propriétaire"
  on public.profils for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Profil : modification par son propriétaire"
  on public.profils for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 2) Stockage des logos -------------------------------------------------
-- Espace "logos" public (le logo doit s'afficher sur le rapport du client),
-- 2 Mo maximum, images PNG / JPEG / WebP uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque consultant ne peut écrire que dans SON dossier : logos/<son id>/...
drop policy if exists "Logos : lecture de son dossier"      on storage.objects;
drop policy if exists "Logos : envoi dans son dossier"      on storage.objects;
drop policy if exists "Logos : remplacement dans son dossier" on storage.objects;
drop policy if exists "Logos : suppression dans son dossier" on storage.objects;

create policy "Logos : lecture de son dossier"
  on storage.objects for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : envoi dans son dossier"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : remplacement dans son dossier"
  on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : suppression dans son dossier"
  on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) Rapport client : ajoute le branding du consultant -------------------
-- (on supprime puis recrée la fonction car ce qu'elle renvoie change)
drop function if exists public.get_rapport_partage(uuid);

create function public.get_rapport_partage(p_lien uuid)
returns table (
  entreprise          text,
  secteur             text,
  created_at          timestamptz,
  diagnostic_json     jsonb,
  expires_at          timestamptz,
  consultant_nom      text,
  consultant_cabinet  text,
  logo_url            text,
  couleur_principale  text,
  lien_calendly       text
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
    select d.entreprise, d.secteur, d.created_at, d.diagnostic_json, d.expires_at,
           p.nom_complet, p.nom_cabinet, p.logo_url, p.couleur_principale, p.lien_calendly
      from public.diagnostics d
      left join public.profils p on p.id = d.user_id
     where d.lien_partage = p_lien
       and d.statut = 'envoyé'
       and d.expires_at > now();
end;
$$;

revoke all on function public.get_rapport_partage(uuid) from public;
grant execute on function public.get_rapport_partage(uuid) to anon, authenticated;

-- 4) Vérification : doit afficher "profils | true" et "logos | true"
select 'profils' as element, rowsecurity as ok from pg_tables where tablename = 'profils'
union all
select id, public from storage.buckets where id = 'logos';
