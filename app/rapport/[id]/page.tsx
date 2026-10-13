// Page PUBLIQUE du rapport : le client l'ouvre avec le lien reçu par email, sans créer de compte.
// Sécurité :
//  - le lien contient un identifiant aléatoire impossible à deviner (UUID) ;
//  - la fonction Supabase "get_rapport_partage" ne renvoie le rapport QUE si le lien existe,
//    que le statut est "envoyé" et que la date d'expiration n'est pas dépassée ;
//  - elle ne renvoie jamais la transcription de l'entretien ;
//  - chaque ouverture est comptée (date, heure, nombre de vues) pour le suivi du consultant ;
//  - la page est exclue des moteurs de recherche (noindex).
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import RapportDiagnostic from '../../components/RapportDiagnostic'
import BoutonImprimer from '../../components/BoutonImprimer'
import type { DiagnosticIA } from '../../lib/diagnostic-schema'
import { couleurSure, couleurTexteSur, lienHttpsSur } from '../../lib/profil'

export const metadata: Metadata = {
  title: 'Votre diagnostic IA',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
}

type Rapport = {
  entreprise: string
  secteur: string
  created_at: string
  diagnostic_json: DiagnosticIA | null
  expires_at: string
  // Branding du consultant (page Paramètres)
  consultant_nom: string | null
  consultant_cabinet: string | null
  logo_url: string | null
  couleur_principale: string | null
  lien_calendly: string | null
}

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// compter = false quand c'est le consultant qui regarde l'aperçu (?apercu=1) : on ne fausse pas le suivi
async function chargerRapport(lien: string, compter: boolean): Promise<Rapport | null> {
  if (!FORMAT_UUID.test(lien)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !cle) return null

  const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })
  let { data, error } = await supabase.rpc('get_rapport_partage', compter ? { p_lien: lien } : { p_lien: lien, p_compter: false })
  if (error && !compter) {
    // Script 06 pas encore exécuté dans Supabase : on affiche quand même le rapport (la vue sera comptée)
    ;({ data, error } = await supabase.rpc('get_rapport_partage', { p_lien: lien }))
  }
  if (error) {
    console.error('[rapport] Lecture impossible :', error.message)
    return null
  }
  const lignes = (data ?? []) as Rapport[]
  return lignes[0] ?? null
}

function Message({ titre, texte }: { titre: string; texte: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
      <div className="max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
        <p className="text-4xl" aria-hidden>🔒</p>
        <h1 className="mt-4 text-2xl font-bold">{titre}</h1>
        <p className="mt-3 text-gray-400">{texte}</p>
      </div>
    </main>
  )
}

export default async function RapportPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>
}) {
  await connection() // page toujours calculée à la demande (jamais mise en cache) : chaque ouverture est comptée
  const { id } = await params
  const { apercu } = await searchParams
  const estApercu = apercu === '1'
  const rapport = await chargerRapport(id, !estApercu)

  if (!rapport) {
    return (
      <Message
        titre="Lien expiré ou invalide"
        texte="Ce lien n’est plus valable (il a peut-être expiré). Contactez votre consultant pour en recevoir un nouveau."
      />
    )
  }
  if (!rapport.diagnostic_json) {
    return <Message titre="Rapport en préparation" texte="Ce diagnostic n’est pas encore disponible. Revenez un peu plus tard." />
  }

  const dateRapport = new Date(rapport.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const finValidite = new Date(rapport.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const couleur = couleurSure(rapport.couleur_principale)
  const texteBouton = couleurTexteSur(couleur)
  const logo = lienHttpsSur(rapport.logo_url)
  const rdv = lienHttpsSur(rapport.lien_calendly)
  const signataire = [rapport.consultant_nom, rapport.consultant_cabinet].filter(Boolean).join(' · ')

  const boutonRdv = rdv && (
    <a href={rdv} target="_blank" rel="noopener noreferrer"
      className="inline-block rounded-lg px-6 py-3 font-semibold transition hover:opacity-90"
      style={{ backgroundColor: couleur, color: texteBouton }}>
      📅 Prendre rendez-vous
    </a>
  )

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 py-10 text-white sm:px-6">
      {estApercu && (
        <p className="mx-auto mb-6 max-w-5xl rounded-lg border border-purple-600 bg-purple-950/40 p-3 text-center text-sm text-purple-100 print:hidden">
          👁️ Aperçu consultant : cette visite n’est pas comptée comme une ouverture du client.
        </p>
      )}
      <div className="mx-auto max-w-5xl">
        {/* Barre de couleur du consultant */}
        <div className="mb-8 h-1.5 w-full rounded-full" style={{ backgroundColor: couleur }} />

        <header className="mb-10 border-b border-gray-800 pb-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt={rapport.consultant_cabinet ?? 'Logo du consultant'} className="max-h-14 max-w-48 rounded bg-white/5 object-contain p-1" />
              : <span />}
            <div className="flex flex-wrap gap-3">
              <BoutonImprimer />
              {boutonRdv}
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: couleur }}>Diagnostic stratégique IA</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{rapport.entreprise}</h1>
          <p className="mt-3 text-gray-400">
            {rapport.secteur && `${rapport.secteur} · `}Rapport du {dateRapport}
            {signataire && ` · Réalisé par ${signataire}`}
          </p>
        </header>

        <RapportDiagnostic d={rapport.diagnostic_json} mode="client" />

        {/* Appel à l'action */}
        {rdv && (
          <section className="mt-12 rounded-xl border p-8 text-center" style={{ borderColor: couleur }}>
            <h2 className="text-2xl font-bold">Passons à l’action</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-400">
              Échangeons 30 minutes sur ces recommandations et sur la meilleure façon de les mettre en place dans votre entreprise.
            </p>
            <div className="mt-6">{boutonRdv}</div>
            {signataire && <p className="mt-4 text-sm text-gray-400">{signataire}</p>}
          </section>
        )}

        <footer className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-400">
          <p>Document confidentiel, destiné uniquement à {rapport.entreprise}. Lien personnel valable jusqu’au {finValidite}.</p>
          <p className="mt-2">
            Les estimations (temps gagné, coûts, impact financier) sont indicatives et reposent sur les informations partagées lors de l’entretien.
          </p>
        </footer>
      </div>
    </main>
  )
}
