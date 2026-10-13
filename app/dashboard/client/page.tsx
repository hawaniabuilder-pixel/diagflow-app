'use client'

// FICHE CLIENT : tout ce qui concerne une entreprise cliente, sur une seule page.
// Adresse : /dashboard/client?nom=Boulangerie%20Dupain
//  - ses coordonnées et vos notes (table "clients", fichier supabase/05_clients.sql)
//  - tous ses diagnostics, avec les chiffres clés (CA facturé, missions signées, impact)
//  - un bouton pour lui faire un nouveau diagnostic (le nom est déjà rempli)

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sAbonnerAucunChangement } from '../../lib/redirection'
import { TEMPLATES, templateSur } from '../../lib/templates'
import PiedDePageLegal from '../../components/PiedDePageLegal'

type Statut = 'brouillon' | 'analysé' | 'validé' | 'envoyé' | 'clos'
type StatutClient = 'prospect' | 'actif' | 'ancien'

type Diag = {
  id: string
  entreprise: string
  secteur: string | null
  effectif: number | null
  ca: string | null
  ville: string | null
  statut: Statut
  created_at: string
  prix_diagnostic: number | null
  envoye_at: string | null
  mission_signee: boolean
  montant_mission: number | null
  vu_par_client: boolean
  impact: number | null
  template?: string | null
}

type FicheClient = {
  id: string | null // null = pas encore de fiche enregistrée
  email: string
  telephone: string
  notes: string
  statut: StatutClient
}

const FICHE_VIDE: FicheClient = { id: null, email: '', telephone: '', notes: '', statut: 'prospect' }

const STATUTS: Record<Statut, { libelle: string; classe: string }> = {
  brouillon: { libelle: 'Brouillon', classe: 'bg-gray-700 text-gray-200' },
  analysé: { libelle: 'Analysé', classe: 'bg-blue-900 text-blue-200' },
  validé: { libelle: 'Validé', classe: 'bg-green-900 text-green-200' },
  envoyé: { libelle: 'Envoyé', classe: 'bg-purple-900 text-purple-200' },
  clos: { libelle: 'Clos', classe: 'bg-gray-800 text-gray-400' },
}

const STATUTS_CLIENT: { valeur: StatutClient; libelle: string }[] = [
  { valeur: 'prospect', libelle: '🌱 Prospect' },
  { valeur: 'actif', libelle: '✅ Client actif' },
  { valeur: 'ancien', libelle: '💤 Ancien client' },
]

const COLONNES = [
  'id', 'entreprise', 'secteur', 'effectif', 'ca', 'ville', 'statut', 'created_at',
  'prix_diagnostic', 'envoye_at', 'mission_signee', 'montant_mission', 'vu_par_client',
  'impact:diagnostic_json->impact_financier->impact_annuel',
].join(', ')

const champ =
  'mt-1 w-full rounded-lg border border-gray-500 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder:italic placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400'

const euros = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

// « %  _  \ » ont un sens spécial dans une recherche : on les neutralise
const motifExact = (texte: string) => texte.replace(/[\\%_]/g, (c) => `\\${c}`)
const normaliser = (texte: string) => texte.trim().toLowerCase()

// Le nom du client est lu dans l'adresse (?nom=…)
const lireNom = () => new URLSearchParams(window.location.search).get('nom')?.trim() ?? ''

export default function FicheClientPage() {
  const router = useRouter()
  const nom = useSyncExternalStore(sAbonnerAucunChangement, lireNom, () => null)

  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [diagnostics, setDiagnostics] = useState<Diag[]>([])
  const [fiche, setFiche] = useState<FicheClient>(FICHE_VIDE)
  const [ficheDisponible, setFicheDisponible] = useState(true) // false si supabase/05_clients.sql manque
  const [etatFiche, setEtatFiche] = useState<'' | 'modifie' | 'enCours' | 'ok' | 'erreur'>('')

  useEffect(() => {
    if (nom === null) return // pas encore dans le navigateur
    async function charger(nomClient: string) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace(`/login?suite=${encodeURIComponent(`/dashboard/client?nom=${encodeURIComponent(nomClient)}`)}`)
        return
      }
      if (!nomClient) {
        setErreur('Aucun client choisi. Revenez au tableau de bord et cliquez sur « 📁 Fiche client ».')
        setChargement(false)
        return
      }
      const uid = session.user.id

      // 1) Ses diagnostics (avec la colonne « template » si le script 08 est installé)
      const lire = (colonnes: string) =>
        supabase.from('diagnostics').select(colonnes).eq('user_id', uid).ilike('entreprise', motifExact(nomClient))
          .order('created_at', { ascending: false })
      let reponse = await lire(`${COLONNES}, template`)
      if (reponse.error && /template/.test(reponse.error.message)) reponse = await lire(COLONNES)
      if (reponse.error) {
        console.error('[fiche client] Diagnostics illisibles :', reponse.error)
        setErreur('Impossible de charger les diagnostics de ce client. Vérifiez votre connexion puis rechargez la page.')
      } else {
        const brutes = (reponse.data ?? []) as unknown as Array<Record<string, unknown>>
        setDiagnostics(brutes
          .filter((d) => normaliser(String(d.entreprise ?? '')) === normaliser(nomClient))
          .map((d) => ({
            ...(d as unknown as Diag),
            impact: typeof d.impact === 'number' ? d.impact : null,
            prix_diagnostic: d.prix_diagnostic == null ? null : Number(d.prix_diagnostic),
            montant_mission: d.montant_mission == null ? null : Number(d.montant_mission),
          })))
      }

      // 2) Sa fiche (coordonnées et notes)
      const { data: fiches, error: erreurFiche } = await supabase.from('clients')
        .select('id, nom_entreprise, email, telephone, notes, statut').eq('user_id', uid)
      if (erreurFiche) {
        console.warn('[fiche client] Table clients indisponible :', erreurFiche.message)
        setFicheDisponible(false)
      } else {
        const trouvee = (fiches ?? []).find((f: { nom_entreprise: string | null }) => normaliser(f.nom_entreprise ?? '') === normaliser(nomClient))
        if (trouvee) {
          setFiche({
            id: trouvee.id,
            email: trouvee.email ?? '',
            telephone: trouvee.telephone ?? '',
            notes: trouvee.notes ?? '',
            statut: (['prospect', 'actif', 'ancien'].includes(trouvee.statut) ? trouvee.statut : 'prospect') as StatutClient,
          })
        }
      }
      setChargement(false)
    }
    charger(nom)
  }, [nom, router])

  // --- Chiffres clés ---
  const stats = useMemo(() => {
    const factures = diagnostics.filter((d) => d.envoye_at).reduce((s, d) => s + (d.prix_diagnostic ?? 0), 0)
    const missions = diagnostics.filter((d) => d.mission_signee).reduce((s, d) => s + (d.montant_mission ?? 0), 0)
    return {
      total: diagnostics.length,
      chiffreAffaires: factures + missions,
      missionsSignees: diagnostics.filter((d) => d.mission_signee).length,
      impact: diagnostics.find((d) => d.impact != null)?.impact ?? null, // le plus récent
    }
  }, [diagnostics])

  const recent = diagnostics[0]
  const nomAffiche = recent?.entreprise ?? nom ?? ''

  function majFiche<K extends keyof FicheClient>(cle: K, valeur: FicheClient[K]) {
    setFiche((f) => ({ ...f, [cle]: valeur }))
    setEtatFiche('modifie')
  }

  async function enregistrerFiche(e: React.FormEvent) {
    e.preventDefault()
    const email = fiche.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEtatFiche('erreur')
      setErreur('L’email du client ne semble pas valide (exemple : contact@entreprise.fr).')
      return
    }
    setErreur('')
    setEtatFiche('enCours')
    const valeurs = {
      email: email || null,
      telephone: fiche.telephone.trim() || null,
      notes: fiche.notes.trim() || null,
      statut: fiche.statut,
    }
    const reponse = fiche.id
      ? await supabase.from('clients').update(valeurs).eq('id', fiche.id).select('id').single()
      : await supabase.from('clients').insert({
        ...valeurs,
        nom_entreprise: nomAffiche.slice(0, 120),
        secteur: recent?.secteur || null,
        ca: recent?.ca || null,
        effectif: recent?.effectif != null ? String(recent.effectif) : null,
      }).select('id').single()
    if (reponse.error) {
      console.error('[fiche client] Enregistrement impossible :', reponse.error)
      setEtatFiche('erreur')
      setErreur('L’enregistrement de la fiche a échoué. Vérifiez votre connexion et réessayez.')
      return
    }
    setFiche((f) => ({ ...f, id: reponse.data.id }))
    setEtatFiche('ok')
  }

  const lienNouveau = `/diagnostic?entreprise=${encodeURIComponent(nomAffiche)}${recent?.secteur ? `&secteur=${encodeURIComponent(recent.secteur)}` : ''}`

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-6">
          <a href="/dashboard" className="text-lg font-bold text-blue-400">Diagnostic IA</a>
          <a href="/dashboard" className="text-sm text-gray-400 transition hover:text-white">← Tableau de bord</a>
        </header>

        {chargement ? (
          <p className="flex items-center gap-3 text-gray-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            Chargement…
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">📁 Fiche client</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-bold sm:text-4xl">{nomAffiche || 'Client'}</h1>
              {nomAffiche && (
                <a href={lienNouveau} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-700">
                  + Nouveau diagnostic pour ce client
                </a>
              )}
            </div>
            {recent && (
              <p className="mt-2 text-gray-400">
                {[recent.secteur, recent.effectif ? `${recent.effectif} salariés` : null, recent.ca, recent.ville].filter(Boolean).join(' · ')}
              </p>
            )}

            {erreur && (
              <p role="alert" className="mt-6 rounded-lg border border-red-700 bg-red-950/70 p-4 text-sm text-red-200">⚠️ {erreur}</p>
            )}

            {nomAffiche && (
              <>
                {/* Chiffres clés */}
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <p className="text-sm text-gray-400">Diagnostics</p>
                    <p className="mt-1 text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="rounded-xl border border-green-800 bg-green-950/40 p-5">
                    <p className="text-sm text-green-300">CA réalisé avec ce client</p>
                    <p className="mt-1 text-2xl font-bold text-green-400">{euros(stats.chiffreAffaires)}</p>
                    <p className="mt-1 text-xs text-gray-400">Diagnostics envoyés + missions signées</p>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <p className="text-sm text-gray-400">Missions signées</p>
                    <p className="mt-1 text-2xl font-bold">{stats.missionsSignees}</p>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <p className="text-sm text-gray-400">Gain estimé pour le client</p>
                    <p className="mt-1 text-2xl font-bold">{stats.impact != null ? euros(stats.impact) : '—'}</p>
                    <p className="mt-1 text-xs text-gray-400">par an (dernier diagnostic)</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                  {/* Coordonnées et notes */}
                  <section className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <h2 className="text-lg font-semibold">Coordonnées et notes</h2>
                    {!ficheDisponible ? (
                      <p className="mt-3 text-sm text-amber-200">
                        Pour garder les coordonnées et vos notes, exécutez d’abord le fichier <code>supabase/05_clients.sql</code> dans Supabase.
                      </p>
                    ) : (
                      <form onSubmit={enregistrerFiche} className="mt-4 space-y-4">
                        <label className="block text-sm text-gray-300">
                          Statut
                          <select className={champ} value={fiche.statut} onChange={(e) => majFiche('statut', e.target.value as StatutClient)}>
                            {STATUTS_CLIENT.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm text-gray-300">
                          Email du dirigeant
                          <input type="email" className={champ} value={fiche.email} maxLength={200} placeholder="ex. : contact@entreprise.fr"
                            onChange={(e) => majFiche('email', e.target.value)} />
                        </label>
                        <label className="block text-sm text-gray-300">
                          Téléphone
                          <input type="tel" className={champ} value={fiche.telephone} maxLength={30} placeholder="ex. : 06 12 34 56 78"
                            onChange={(e) => majFiche('telephone', e.target.value)} />
                        </label>
                        <label className="block text-sm text-gray-300">
                          Notes (visibles par vous seul)
                          <textarea className={`${champ} min-h-32`} value={fiche.notes} maxLength={10000}
                            placeholder="ex. : décideur = la gérante, budget serré jusqu’en janvier, rappeler après le salon…"
                            onChange={(e) => majFiche('notes', e.target.value)} />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <button type="submit" disabled={etatFiche === 'enCours'}
                            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-700 disabled:opacity-50">
                            {etatFiche === 'enCours' ? 'Enregistrement…' : '💾 Enregistrer la fiche'}
                          </button>
                          <span role="status" className="text-sm">
                            {etatFiche === 'ok' && <span className="text-green-400">✅ Enregistré</span>}
                            {etatFiche === 'modifie' && <span className="text-amber-300">Modifications non enregistrées</span>}
                          </span>
                        </div>
                      </form>
                    )}
                  </section>

                  {/* Historique des diagnostics */}
                  <section className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <h2 className="text-lg font-semibold">Historique des diagnostics</h2>
                    {diagnostics.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-400">Aucun diagnostic pour ce client.</p>
                    ) : (
                      <ul className="mt-4 divide-y divide-gray-700">
                        {diagnostics.map((d) => {
                          const s = STATUTS[d.statut] ?? STATUTS.brouillon
                          const analyse = d.statut !== 'brouillon'
                          return (
                            <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {dateCourte(d.created_at)}{' '}
                                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${s.classe}`}>{s.libelle}</span>
                                  {d.template && (
                                    <span className="ml-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200">
                                      {TEMPLATES[templateSur(d.template)].emoji} {TEMPLATES[templateSur(d.template)].nom}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  {[
                                    d.prix_diagnostic != null ? `Facturé ${euros(d.prix_diagnostic)}` : null,
                                    d.mission_signee ? `Mission signée${d.montant_mission ? ` (${euros(d.montant_mission)})` : ''}` : null,
                                    d.vu_par_client ? '👀 ouvert par le client' : null,
                                  ].filter(Boolean).join(' · ') || '—'}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <a href={analyse ? `/diagnostic?id=${d.id}#resultat` : `/diagnostic?id=${d.id}`}
                                  className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">
                                  {analyse ? '👁️ Voir' : '✏️ Compléter'}
                                </a>
                                {analyse && (
                                  <a href={`/diagnostic/${d.id}/relecture`} className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">
                                    ✏️ Relire
                                  </a>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}

        <PiedDePageLegal className="mt-12" />
      </div>
    </main>
  )
}
