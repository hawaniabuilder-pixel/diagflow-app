'use client'

// Tableau de bord du consultant.
//  - Chiffres clés : CA du mois, nombre de diagnostics, taux de conversion, impact estimé
//  - Tableau triable (clic sur un titre de colonne) avec filtres : statut, dates, client
//  - Saisie rapide du prix facturé et de la mission signée, directement dans le tableau
//  - Actions : Nouveau, Voir, Modifier, Envoyer, Supprimer
//  - Équipe : bouton 👥 pour partager un diagnostic, et liste « Partagés par votre équipe »
// Grâce aux règles RLS de Supabase, chaque consultant ne voit que SES diagnostics
// (plus ceux que son équipe a choisi de partager).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { chargerProfil, finEmail, PROFIL_DEFAUT, type Profil } from '../lib/profil'
import { joursDepuisEnvoi, lienMailto, modeleEmail, prochaineRelance, relanceDue } from '../lib/relances'
import { chargerMembres, chargerMonEquipe, etatLicence, infoRole, type Membre, type ResumeEquipe } from '../lib/equipe'
import { dateSuivi, modeleEmailSuivi, prochainSuivi, suiviDu, type EtapeSuivi } from '../lib/suivi'
import { TEMPLATES, templateSur } from '../lib/templates'
import NotificationBell from '../components/NotificationBell'
import GuideDemarrage from '../components/GuideDemarrage'
import PiedDePageLegal from '../components/PiedDePageLegal'
import { demanderEmailBienvenue } from '../lib/emails'

type Statut = 'brouillon' | 'analysé' | 'validé' | 'envoyé' | 'clos'

type LigneDiagnostic = {
  id: string
  entreprise: string
  secteur: string
  effectif: number | null
  statut: Statut
  created_at: string
  updated_at: string
  impact: number | null
  vu_par_client: boolean
  nb_vues: number
  last_viewed_at: string | null
  prix_diagnostic: number | null
  envoye_at: string | null
  mission_signee: boolean
  montant_mission: number | null
  mission_signee_at: string | null
  email_client: string | null
  lien_partage: string | null
  expires_at: string | null
  relance_j3_at: string | null
  relance_j7_at: string | null
  relance_j14_at: string | null
  relances_stoppees: boolean
  partage_equipe?: boolean // absent tant que supabase/07_equipes.sql n'a pas été exécuté
  // Ajoutés par supabase/08_templates.sql (absents avant)
  template?: string | null
  suivi_m1_at?: string | null
  suivi_m2_at?: string | null
  suivi_m3_at?: string | null
}

// Diagnostic partagé par un collègue (lecture seule)
type LignePartagee = {
  id: string
  user_id: string
  entreprise: string
  secteur: string
  statut: Statut
  updated_at: string
}

type CleTri = 'entreprise' | 'statut' | 'created_at' | 'impact' | 'prix_diagnostic'

const STATUTS: { valeur: Statut; libelle: string; classe: string }[] = [
  { valeur: 'brouillon', libelle: 'Brouillon', classe: 'bg-gray-700 text-gray-200' },
  { valeur: 'analysé', libelle: 'Analysé', classe: 'bg-blue-900 text-blue-200' },
  { valeur: 'validé', libelle: 'Validé', classe: 'bg-green-900 text-green-200' },
  { valeur: 'envoyé', libelle: 'Envoyé', classe: 'bg-purple-900 text-purple-200' },
  { valeur: 'clos', libelle: 'Clos', classe: 'bg-gray-800 text-gray-400' },
]

const COLONNES_SELECT = [
  'id', 'entreprise', 'secteur', 'effectif', 'statut', 'created_at', 'updated_at',
  'vu_par_client', 'nb_vues', 'last_viewed_at',
  'prix_diagnostic', 'envoye_at', 'mission_signee', 'montant_mission', 'mission_signee_at',
  'email_client', 'lien_partage', 'expires_at', 'relance_j3_at', 'relance_j7_at', 'relance_j14_at', 'relances_stoppees',
  // un seul chiffre tiré du JSON de l'IA (on ne charge pas la transcription, trop lourde)
  'impact:diagnostic_json->impact_financier->impact_annuel',
].join(', ')

// Colonnes des templates (script 08) : chargées à part pour ne rien bloquer si le script manque
const COLONNES_TEMPLATES = 'template, suivi_m1_at, suivi_m2_at, suivi_m3_at'

const euros = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

// Vrai si la date tombe dans le mois en cours
function ceMois(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  const maintenant = new Date()
  return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth()
}

// Transforme "1 200,50" en 1200.5 (ou null si vide / invalide)
function versNombre(texte: string): number | null {
  const n = Number(texte.replace(/\s/g, '').replace(',', '.'))
  return texte.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n
}

function Badge({ statut }: { statut: Statut }) {
  const s = STATUTS.find((x) => x.valeur === statut) ?? STATUTS[0]
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${s.classe}`}>{s.libelle}</span>
}

function CarteStat({ titre, valeur, detail, accent }: { titre: string; valeur: string; detail?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'border-green-800 bg-green-950/40' : 'border-gray-700 bg-gray-800'}`}>
      <p className={`text-sm ${accent ? 'text-green-300' : 'text-gray-400'}`}>{titre}</p>
      <p className={`mt-1 text-2xl font-bold sm:text-3xl ${accent ? 'text-green-400' : 'text-white'}`}>{valeur}</p>
      {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
    </div>
  )
}

const champClass =
  'rounded-lg border border-gray-500 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder:italic placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400'

// Lit uniquement les diagnostics de la personne connectée
function lireMesDiagnostics(uid: string, colonnes: string) {
  return supabase.from('diagnostics').select(colonnes).eq('user_id', uid)
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [lignes, setLignes] = useState<LigneDiagnostic[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [profilCharge, setProfilCharge] = useState(false)

  // Filtres
  const [client, setClient] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'' | Statut>('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  // Tri
  const [tri, setTri] = useState<{ cle: CleTri; sens: 'asc' | 'desc' }>({ cle: 'created_at', sens: 'desc' })

  // Suppression en 2 clics
  const [aConfirmer, setAConfirmer] = useState<string | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)

  // Équipe
  const uidRef = useRef<string | null>(null)
  const [equipe, setEquipe] = useState<ResumeEquipe | null>(null)
  const [membres, setMembres] = useState<Membre[]>([])
  const [partages, setPartages] = useState<LignePartagee[]>([])

  // --- Chargement ---
  const charger = useCallback(async () => {
    const uid = uidRef.current
    if (!uid) return
    setErreur('')
    // Seulement MES diagnostics (ceux partagés par l'équipe sont chargés à part, plus bas)
    // Colonnes ajoutées par les scripts 07 (équipe) et 08 (templates) : si un script n'a pas encore
    // été exécuté, on recharge sans ses colonnes plutôt que de tout bloquer.
    const groupes = { equipe: true, templates: true }
    const colonnes = () =>
      [COLONNES_SELECT, groupes.equipe && 'partage_equipe', groupes.templates && COLONNES_TEMPLATES].filter(Boolean).join(', ')
    let reponse = await lireMesDiagnostics(uid, colonnes())
    for (let essai = 0; essai < 2 && reponse.error; essai++) {
      const message = reponse.error?.message ?? ''
      if (groupes.templates && /template|suivi_m/.test(message)) groupes.templates = false
      else if (groupes.equipe && /partage_equipe/.test(message)) groupes.equipe = false
      else break
      reponse = await lireMesDiagnostics(uid, colonnes())
    }
    const { data, error } = reponse

    if (error) {
      console.error('[dashboard] Chargement impossible :', error)
      // Code 42703 = colonne inconnue : le script SQL du suivi commercial n'a pas encore été exécuté
      setErreur(error.code === '42703' || /does not exist/i.test(error.message)
        ? 'Il manque des colonnes dans la base : exécutez les fichiers supabase/02_suivi_commercial.sql puis supabase/03_relances.sql dans Supabase (SQL Editor), puis rechargez la page.'
        : 'Impossible de charger vos diagnostics. Vérifiez votre connexion puis rechargez la page.')
    } else {
      const brutes = (data ?? []) as unknown as Array<Record<string, unknown>>
      setLignes(brutes.map((d) => ({
        ...(d as unknown as LigneDiagnostic),
        impact: typeof d.impact === 'number' ? d.impact : null,
        // Supabase renvoie les montants "numeric" sous forme de texte : on les convertit en nombres
        prix_diagnostic: d.prix_diagnostic == null ? null : Number(d.prix_diagnostic),
        montant_mission: d.montant_mission == null ? null : Number(d.montant_mission),
      })))
    }

    // Équipe : mon rôle, les membres, et les diagnostics que mes collègues partagent
    const { equipe: e } = await chargerMonEquipe()
    setEquipe(e)
    if (e?.active) {
      const [m, p] = await Promise.all([
        chargerMembres(),
        supabase.from('diagnostics')
          .select('id, user_id, entreprise, secteur, statut, updated_at')
          .eq('partage_equipe', true)
          .neq('user_id', uid)
          .order('updated_at', { ascending: false }),
      ])
      setMembres(m)
      if (p.error) console.error('[dashboard] Diagnostics partagés illisibles :', p.error)
      setPartages(((p.data ?? []) as unknown) as LignePartagee[])
    } else {
      setMembres([])
      setPartages([])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setEmail(session.user.email ?? '')
      uidRef.current = session.user.id
      demanderEmailBienvenue(session.user.id, session.access_token) // 👋 une seule fois par compte (sans attendre)
      chargerProfil().then((p) => {
        setProfil(p)
        setProfilCharge(true)
      })
      await charger()
    }
    init()
  }, [router, charger])

  // --- Mise à jour d'une ligne (prix, mission) : on affiche tout de suite, puis on enregistre ---
  async function majLigne(id: string, champs: Partial<LigneDiagnostic>) {
    setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...champs } : l)))
    const { error } = await supabase.from('diagnostics').update(champs).eq('id', id)
    if (error) {
      console.error('[dashboard] Mise à jour impossible :', error)
      setErreur('L’enregistrement a échoué. Vérifiez votre connexion.')
      charger() // on recharge pour afficher les vraies valeurs
    }
  }

  function changerPrix(l: LigneDiagnostic, texte: string) {
    const prix = versNombre(texte)
    if (prix !== l.prix_diagnostic) majLigne(l.id, { prix_diagnostic: prix })
  }

  function changerMission(l: LigneDiagnostic, signee: boolean) {
    majLigne(l.id, {
      mission_signee: signee,
      mission_signee_at: signee ? new Date().toISOString() : null,
      montant_mission: signee ? l.montant_mission : null,
    })
  }

  function changerMontantMission(l: LigneDiagnostic, texte: string) {
    const montant = versNombre(texte)
    if (montant !== l.montant_mission) majLigne(l.id, { montant_mission: montant })
  }

  async function supprimer(id: string) {
    setSuppressionEnCours(id)
    const { error } = await supabase.from('diagnostics').delete().eq('id', id)
    setSuppressionEnCours(null)
    setAConfirmer(null)
    if (error) {
      console.error('[dashboard] Suppression impossible :', error)
      setErreur('La suppression a échoué. Réessayez.')
      return
    }
    setLignes((ls) => ls.filter((x) => x.id !== id))
  }

  async function deconnexion() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function trierPar(cle: CleTri) {
    setTri((t) => (t.cle === cle ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: cle === 'entreprise' ? 'asc' : 'desc' }))
  }

  function effacerFiltres() {
    setClient('')
    setFiltreStatut('')
    setDateDebut('')
    setDateFin('')
  }

  // --- Filtres puis tri ---
  const lignesAffichees = useMemo(() => {
    const q = client.trim().toLowerCase()
    const debut = dateDebut ? new Date(`${dateDebut}T00:00:00`) : null
    const fin = dateFin ? new Date(`${dateFin}T23:59:59`) : null

    const filtrees = lignes.filter((l) => {
      const cree = new Date(l.created_at)
      return (!q || l.entreprise.toLowerCase().includes(q))
        && (!filtreStatut || l.statut === filtreStatut)
        && (!debut || cree >= debut)
        && (!fin || cree <= fin)
    })

    const ordreStatut = (s: Statut) => STATUTS.findIndex((x) => x.valeur === s)
    const valeur = (l: LigneDiagnostic): string | number => {
      switch (tri.cle) {
        case 'entreprise': return l.entreprise.toLowerCase()
        case 'statut': return ordreStatut(l.statut)
        case 'created_at': return new Date(l.created_at).getTime()
        case 'impact': return l.impact ?? -1
        case 'prix_diagnostic': return l.prix_diagnostic ?? -1
      }
    }
    const signe = tri.sens === 'asc' ? 1 : -1
    return [...filtrees].sort((a, b) => {
      const va = valeur(a)
      const vb = valeur(b)
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'fr') * signe
      return ((va as number) - (vb as number)) * signe
    })
  }, [lignes, client, filtreStatut, dateDebut, dateFin, tri])

  // --- Chiffres clés ---
  const stats = useMemo(() => {
    const caDiagnostics = lignes.filter((l) => ceMois(l.envoye_at)).reduce((s, l) => s + (l.prix_diagnostic ?? 0), 0)
    const caMissions = lignes.filter((l) => l.mission_signee && ceMois(l.mission_signee_at)).reduce((s, l) => s + (l.montant_mission ?? 0), 0)
    const envoyes = lignes.filter((l) => l.envoye_at).length
    const signes = lignes.filter((l) => l.envoye_at && l.mission_signee).length
    return {
      caMois: caDiagnostics + caMissions,
      caMissions,
      total: lignes.length,
      totalMois: lignes.filter((l) => ceMois(l.created_at)).length,
      envoyes,
      signes,
      conversion: envoyes > 0 ? Math.round((signes / envoyes) * 100) : null,
      impactTotal: lignes.reduce((s, l) => s + (l.impact ?? 0), 0),
    }
  }, [lignes])

  // --- Relances : celles à faire aujourd'hui, et les prochaines ---
  const relancesAFaire = useMemo(
    () => lignes.flatMap((l) => {
      const etape = relanceDue(l)
      return etape ? [{ ligne: l, etape }] : []
    }),
    [lignes],
  )
  const relancesAVenir = useMemo(
    () => lignes
      .flatMap((l) => {
        const p = prochaineRelance(l)
        return p && !relanceDue(l) ? [{ ligne: l, ...p }] : []
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [lignes],
  )
  const [emailsPrepares, setEmailsPrepares] = useState<Record<string, boolean>>({})

  // --- Suivi Premium : rendez-vous à 1, 2 et 3 mois après l'envoi du rapport ---
  const suivisAFaire = useMemo(
    () => lignes.flatMap((l) => {
      const etape = suiviDu(l)
      return etape ? [{ ligne: l, etape }] : []
    }),
    [lignes],
  )
  const suivisAVenir = useMemo(
    () => lignes
      .flatMap((l) => {
        const p = prochainSuivi(l)
        return p && !suiviDu(l) ? [{ ligne: l, ...p }] : []
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [lignes],
  )
  const [suivisPrepares, setSuivisPrepares] = useState<Record<string, boolean>>({})

  function lienRapport(l: LigneDiagnostic) {
    const valide = l.lien_partage && l.expires_at && new Date(l.expires_at) > new Date()
    return valide ? `${window.location.origin}/rapport/${l.lien_partage}` : null
  }

  function preparerRelance(l: LigneDiagnostic, etape: NonNullable<ReturnType<typeof relanceDue>>) {
    const { objet, corps } = modeleEmail(etape.cle, l.entreprise, lienRapport(l), finEmail(profil))
    setEmailsPrepares((e) => ({ ...e, [l.id]: true }))
    window.location.href = lienMailto(l.email_client, objet, corps) // ouvre la messagerie avec l'email pré-rempli
  }

  function preparerSuivi(l: LigneDiagnostic, etape: EtapeSuivi) {
    const { objet, corps } = modeleEmailSuivi(etape, l.entreprise, lienRapport(l), finEmail(profil))
    setSuivisPrepares((e) => ({ ...e, [l.id]: true }))
    window.location.href = lienMailto(l.email_client, objet, corps)
  }

  function marquerSuiviFait(l: LigneDiagnostic, etape: EtapeSuivi) {
    setSuivisPrepares((e) => ({ ...e, [l.id]: false }))
    majLigne(l.id, { [etape.colonne]: new Date().toISOString() } as Partial<LigneDiagnostic>)
  }

  function marquerRelanceFaite(l: LigneDiagnostic, etape: NonNullable<ReturnType<typeof relanceDue>>) {
    setEmailsPrepares((e) => ({ ...e, [l.id]: false }))
    majLigne(l.id, { [etape.colonne]: new Date().toISOString() } as Partial<LigneDiagnostic>)
  }

  const nomMois = new Date().toLocaleDateString('fr-FR', { month: 'long' })
  const estViewer = equipe?.mon_role === 'viewer'
  const peutPartager = Boolean(equipe?.active) && !estViewer
  const nomAuteur = (userId: string) => membres.find((m) => m.user_id === userId)?.nom ?? 'Un collègue'
  const filtresActifs = Boolean(client || filtreStatut || dateDebut || dateFin)

  // 🚀 Guide « Bien démarrer » : les 4 premières étapes (cochées automatiquement)
  const aRelire = lignes.find((l) => l.statut === 'analysé')
  const aEnvoyer = lignes.find((l) => l.statut === 'analysé' || l.statut === 'validé')
  const etapesGuide = [
    {
      fait: Boolean(profil.nom_complet?.trim() && profil.nom_cabinet?.trim()),
      titre: 'Compléter mon profil',
      detail: 'Nom, cabinet et logo : ils apparaissent sur vos rapports.',
      lien: '/dashboard/settings',
      bouton: 'Ouvrir les paramètres',
    },
    {
      fait: lignes.length > 0,
      titre: 'Créer mon premier diagnostic',
      detail: 'Astuce : activez le 🧪 Mode Démo dans les paramètres pour essayer gratuitement.',
      lien: '/diagnostic',
      bouton: 'Nouveau diagnostic',
    },
    {
      fait: lignes.some((l) => ['validé', 'envoyé', 'clos'].includes(l.statut)),
      titre: 'Relire et valider un rapport',
      detail: 'Vous gardez la main : corrigez l’analyse de l’IA avant de l’envoyer.',
      lien: aRelire ? `/diagnostic/${aRelire.id}/relecture` : '/diagnostic',
      bouton: 'Relire un rapport',
    },
    {
      fait: lignes.some((l) => Boolean(l.envoye_at)),
      titre: 'Envoyer mon premier rapport',
      detail: 'Un lien sécurisé pour votre client, et vous voyez quand il l’ouvre.',
      lien: aEnvoyer ? `/diagnostic?id=${aEnvoyer.id}#envoi` : '/diagnostic',
      bouton: 'Envoyer un rapport',
    },
  ]

  // Titre de colonne cliquable pour trier
  function titre(cle: CleTri, children: string, droite = false) {
    const actif = tri.cle === cle
    return (
      <th key={cle} scope="col" className={`px-4 py-3 ${droite ? 'text-right' : 'text-left'}`}
        aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => trierPar(cle)}
          className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition hover:text-white ${actif ? 'text-blue-300' : ''}`}>
          {children}
          <span aria-hidden className="text-[10px]">{actif ? (tri.sens === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* En-tête + actions rapides */}
        <header className="mb-10 flex flex-col gap-4 border-b border-gray-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/" className="text-lg font-bold text-blue-400">Vizion</a>
            {email && <p className="mt-1 text-sm text-gray-400">Connecté : {email}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {estViewer ? (
              <span className="rounded-lg border border-gray-600 px-4 py-3 text-sm text-gray-300" title="Votre rôle Viewer permet de consulter les diagnostics partagés">
                👁️ Lecture seule (Viewer)
              </span>
            ) : (
              <a href="/diagnostic" className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold transition hover:bg-orange-600">
                + Nouveau diagnostic
              </a>
            )}
            <a href="/dashboard/equipe" className="rounded-lg border border-gray-600 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-400 hover:text-white">
              👥 Équipe
            </a>
            <a href="/dashboard/settings" className="rounded-lg border border-gray-600 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-400 hover:text-white">
              ⚙️ Paramètres
            </a>
            <button type="button" onClick={deconnexion}
              className="rounded-lg border border-red-800 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-950">
              Déconnexion
            </button>
            {/* 🔔 Notifications (en haut à droite) */}
            <NotificationBell />
          </div>
        </header>

        <h1 className="text-3xl font-bold">Tableau de bord</h1>

        {/* 🚀 Bien démarrer (disparaît quand tout est fait) */}
        {!chargement && profilCharge && !estViewer && <GuideDemarrage etapes={etapesGuide} />}

        {/* Chiffres clés */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CarteStat accent titre={`CA de ${nomMois}`} valeur={euros(stats.caMois)}
            detail={stats.caMissions > 0 ? `dont ${euros(stats.caMissions)} de missions signées` : 'Diagnostics envoyés + missions signées ce mois'} />
          <CarteStat titre="Diagnostics" valeur={String(stats.total)} detail={`${stats.totalMois} créé${stats.totalMois > 1 ? 's' : ''} ce mois-ci`} />
          <CarteStat titre="Taux de conversion" valeur={stats.conversion == null ? '—' : `${stats.conversion} %`}
            detail={`${stats.signes} mission${stats.signes > 1 ? 's' : ''} signée${stats.signes > 1 ? 's' : ''} sur ${stats.envoyes} diagnostic${stats.envoyes > 1 ? 's' : ''} envoyé${stats.envoyes > 1 ? 's' : ''}`} />
          <CarteStat titre="Impact estimé cumulé" valeur={euros(stats.impactTotal)} detail="par an, pour vos clients" />
        </div>

        {erreur && (
          <p role="alert" className="mt-6 rounded-lg border border-red-700 bg-red-950/70 p-4 text-sm text-red-200">⚠️ {erreur}</p>
        )}

        {/* Relances */}
        {!chargement && (relancesAFaire.length > 0 || relancesAVenir.length > 0) && (
          <section className="mt-8 rounded-xl border border-yellow-800/60 bg-gray-800 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                📬 Relances à faire aujourd’hui
                {relancesAFaire.length > 0 && (
                  <span className="ml-2 rounded-full bg-yellow-600 px-2 py-0.5 text-xs font-bold text-black">{relancesAFaire.length}</span>
                )}
              </h2>
              <p className="text-xs text-gray-400">Elles s’arrêtent d’elles-mêmes quand la mission est signée.</p>
            </div>

            {relancesAFaire.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">✅ Rien à faire aujourd’hui.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {relancesAFaire.map(({ ligne: l, etape }) => (
                  <li key={l.id} className="flex flex-col gap-3 rounded-lg bg-gray-900/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold">
                        {l.entreprise}{' '}
                        <span className="ml-1 rounded bg-yellow-900/60 px-2 py-0.5 text-xs font-medium text-yellow-200">{etape.libelle}</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Envoyé il y a {joursDepuisEnvoi(l.envoye_at!)} jours
                        {' · '}{l.vu_par_client ? '👀 rapport ouvert' : 'rapport pas encore ouvert'}
                        {' · '}{l.email_client ?? <span className="text-yellow-300">email du client inconnu</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => preparerRelance(l, etape)}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold transition hover:bg-orange-600">
                        📧 Préparer l’email
                      </button>
                      <button type="button" onClick={() => marquerRelanceFaite(l, etape)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${emailsPrepares[l.id] ? 'bg-green-600 hover:bg-green-700' : 'border border-gray-600 text-gray-300 hover:text-white'}`}>
                        ✅ Marquer comme faite
                      </button>
                      <button type="button" onClick={() => majLigne(l.id, { relances_stoppees: true })}
                        title="Le client ne souhaite plus être relancé"
                        className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-400 transition hover:border-red-700 hover:text-red-300">
                        Ne plus relancer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {relancesAVenir.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-white">Prochaines relances ({relancesAVenir.length})</summary>
                <ul className="mt-2 space-y-1 text-gray-400">
                  {relancesAVenir.map(({ ligne: l, etape, date }) => (
                    <li key={l.id}>
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {l.entreprise} · {etape.libelle}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Suivi Premium : rendez-vous à 1, 2 et 3 mois */}
        {!chargement && (suivisAFaire.length > 0 || suivisAVenir.length > 0) && (
          <section className="mt-8 rounded-xl border border-amber-700/60 bg-gray-800 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                📅 Suivis Premium à faire
                {suivisAFaire.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">{suivisAFaire.length}</span>
                )}
              </h2>
              <p className="text-xs text-gray-400">Rendez-vous à 1, 2 et 3 mois après l’envoi d’un rapport Premium.</p>
            </div>
            {suivisAFaire.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">✅ Aucun point de suivi à faire aujourd’hui.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {suivisAFaire.map(({ ligne: l, etape }) => (
                  <li key={l.id} className="flex flex-col gap-3 rounded-lg bg-gray-900/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold">
                        {l.entreprise}{' '}
                        <span className="ml-1 rounded bg-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-200">{etape.libelle}</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Prévu le {dateSuivi(l, etape).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        {' · '}{l.email_client ?? <span className="text-yellow-300">email du client inconnu</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => preparerSuivi(l, etape)}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold transition hover:bg-orange-600">
                        📧 Proposer le rendez-vous
                      </button>
                      <button type="button" onClick={() => marquerSuiviFait(l, etape)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${suivisPrepares[l.id] ? 'bg-green-600 hover:bg-green-700' : 'border border-gray-600 text-gray-300 hover:text-white'}`}>
                        ✅ Point fait
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {suivisAVenir.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-white">Prochains points de suivi ({suivisAVenir.length})</summary>
                <ul className="mt-2 space-y-1 text-gray-400">
                  {suivisAVenir.map(({ ligne: l, etape, date }) => (
                    <li key={l.id}>
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {l.entreprise} · {etape.libelle}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Filtres */}
        <div className="mt-8 grid gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-xs font-medium text-gray-400">
            Client
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="🔍 Nom de l’entreprise…"
              className={`mt-1 w-full ${champClass}`} />
          </label>
          <label className="text-xs font-medium text-gray-400">
            Statut
            <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value as '' | Statut)} className={`mt-1 w-full ${champClass}`}>
              <option value="">Tous</option>
              {STATUTS.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-400">
            Créé à partir du
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={`mt-1 w-full ${champClass} [color-scheme:dark]`} />
          </label>
          <label className="text-xs font-medium text-gray-400">
            Jusqu’au
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={`mt-1 w-full ${champClass} [color-scheme:dark]`} />
          </label>
          <button type="button" onClick={effacerFiltres} disabled={!filtresActifs}
            className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm text-gray-300 transition hover:text-white disabled:opacity-40">
            Effacer
          </button>
        </div>

        {/* Tableau */}
        <section className="mt-6 overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
          {chargement ? (
            <p className="flex items-center gap-3 p-8 text-gray-400">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
              Chargement…
            </p>
          ) : lignes.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-4xl" aria-hidden>📋</p>
              <p className="mt-3 font-medium">Aucun diagnostic pour l’instant</p>
              {estViewer ? (
                <p className="mt-1 text-sm text-gray-400">En tant que Viewer, vous consultez les diagnostics partagés par votre équipe (plus bas).</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-gray-400">Commencez par saisir votre premier entretien client.</p>
                  <a href="/diagnostic" className="mt-5 inline-block rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold transition hover:bg-orange-600">
                    + Nouveau diagnostic
                  </a>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="border-b border-gray-700 px-4 py-3 text-sm text-gray-400">
                {lignesAffichees.length} diagnostic{lignesAffichees.length > 1 ? 's' : ''}
                {filtresActifs && ` sur ${lignes.length}`} · cliquez sur un titre de colonne pour trier
              </p>
              {/* Sur petit écran, le tableau défile horizontalement */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <caption className="sr-only">Liste de vos diagnostics. Les titres de colonnes Client, Statut, Créé le, Impact et Prix permettent de trier.</caption>
                  <thead className="text-xs text-gray-400">
                    <tr className="border-b border-gray-700">
                      {titre('entreprise', 'Client')}
                      {titre('statut', 'Statut')}
                      {titre('created_at', 'Créé le')}
                      {titre('impact', 'Impact / an', true)}
                      {titre('prix_diagnostic', 'Prix facturé', true)}
                      <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Mission signée</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {lignesAffichees.map((l) => {
                      const analyse = l.statut !== 'brouillon'
                      return (
                        <tr key={l.id} className="align-top transition hover:bg-gray-700/30">
                          {/* Client */}
                          <td className="px-4 py-4">
                            <a href={`/diagnostic?id=${l.id}`} className="font-semibold hover:text-blue-300 hover:underline">{l.entreprise}</a>
                            {l.template && (
                              <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${l.template === 'premium' ? 'bg-amber-900/60 text-amber-200' : 'bg-gray-700 text-gray-200'}`}>
                                {TEMPLATES[templateSur(l.template)].emoji} {TEMPLATES[templateSur(l.template)].nom}
                              </span>
                            )}
                            {l.partage_equipe && (
                              <span className="ml-2 inline-block rounded-full bg-purple-900/70 px-2 py-0.5 text-[11px] font-medium text-purple-200">👥 Partagé</span>
                            )}
                            <p className="text-xs text-gray-400">
                              {[l.secteur, l.effectif ? `${l.effectif} salariés` : null].filter(Boolean).join(' · ') || '—'}
                            </p>
                            <a href={`/dashboard/client?nom=${encodeURIComponent(l.entreprise)}`}
                              className="mt-1 inline-block text-xs text-blue-300 hover:underline" aria-label={`Fiche client ${l.entreprise}`}>
                              📁 Fiche client
                            </a>
                          </td>
                          {/* Statut + suivi d'ouverture */}
                          <td className="px-4 py-4">
                            <Badge statut={l.statut} />
                            {l.vu_par_client && l.last_viewed_at ? (
                              <p className="mt-1 text-xs text-green-400" title={`${l.nb_vues} vue(s)`}>
                                👀 Ouvert le {new Date(l.last_viewed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à {heure(l.last_viewed_at)}
                              </p>
                            ) : l.statut === 'envoyé' ? (
                              <p className="mt-1 text-xs text-gray-400">⏳ Pas encore ouvert</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-gray-300">{dateCourte(l.created_at)}</td>
                          <td className={`px-4 py-4 text-right ${l.impact ? 'font-medium text-green-400' : 'text-gray-400'}`}>
                            {l.impact ? euros(l.impact) : '—'}
                          </td>
                          {/* Prix facturé : modifiable directement, enregistré quand on quitte la case */}
                          <td className="px-4 py-4 text-right">
                            <label className="sr-only" htmlFor={`prix-${l.id}`}>Prix facturé pour {l.entreprise}</label>
                            <input id={`prix-${l.id}`} key={`prix-${l.id}-${l.prix_diagnostic}`} inputMode="decimal" placeholder="— €"
                              defaultValue={l.prix_diagnostic ?? ''}
                              onBlur={(e) => changerPrix(l, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              className={`w-28 text-right ${champClass}`} />
                          </td>
                          {/* Mission signée */}
                          <td className="px-4 py-4">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input type="checkbox" className="h-4 w-4 accent-green-500" checked={l.mission_signee}
                                aria-label={`Mission signée pour ${l.entreprise}`}
                                onChange={(e) => changerMission(l, e.target.checked)} />
                              {l.mission_signee ? 'Oui' : 'Non'}
                            </label>
                            {l.mission_signee && (
                              <input key={`mission-${l.id}-${l.montant_mission}`} inputMode="decimal" placeholder="Montant €"
                                aria-label={`Montant de la mission pour ${l.entreprise}`}
                                defaultValue={l.montant_mission ?? ''}
                                onBlur={(e) => changerMontantMission(l, e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                className={`mt-2 w-28 ${champClass}`} />
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              {aConfirmer === l.id ? (
                                <>
                                  <button type="button" onClick={() => supprimer(l.id)} disabled={suppressionEnCours === l.id}
                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold transition hover:bg-red-700 disabled:opacity-50">
                                    {suppressionEnCours === l.id ? 'Suppression…' : 'Confirmer'}
                                  </button>
                                  <button type="button" onClick={() => setAConfirmer(null)}
                                    className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition hover:text-white">
                                    Annuler
                                  </button>
                                </>
                              ) : (
                                <>
                                  {analyse ? (
                                    <a href={`/diagnostic?id=${l.id}#resultat`} title="Voir le diagnostic" aria-label={`Voir le diagnostic ${l.entreprise}`}
                                      className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">👁️ Voir</a>
                                  ) : (
                                    <span title="Pas encore analysé" aria-disabled="true" className="cursor-not-allowed rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-600">👁️ Voir</span>
                                  )}
                                  <a href={analyse ? `/diagnostic/${l.id}/relecture` : `/diagnostic?id=${l.id}`} title={analyse ? 'Relire et modifier le diagnostic' : 'Compléter le formulaire'} aria-label={`Modifier le diagnostic ${l.entreprise}`}
                                    className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">✏️ Modifier</a>
                                  {analyse ? (
                                    <a href={`/diagnostic?id=${l.id}#envoi`} title="Envoyer au client" aria-label={`Envoyer le diagnostic ${l.entreprise} au client`}
                                      className="rounded-lg border border-blue-500 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20">📧 Envoyer</a>
                                  ) : (
                                    <span title="Lancez d’abord l’analyse IA" aria-disabled="true" className="cursor-not-allowed rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-600">📧 Envoyer</span>
                                  )}
                                  {peutPartager && (
                                    <button type="button" onClick={() => majLigne(l.id, { partage_equipe: !l.partage_equipe })}
                                      aria-pressed={Boolean(l.partage_equipe)}
                                      title={l.partage_equipe ? 'Ne plus partager avec l’équipe' : 'Partager avec l’équipe (lecture seule)'}
                                      aria-label={`${l.partage_equipe ? 'Ne plus partager' : 'Partager'} le diagnostic ${l.entreprise} avec l’équipe`}
                                      className={`rounded-lg border px-3 py-2 text-xs transition ${l.partage_equipe ? 'border-purple-500 bg-purple-500/20 text-purple-100' : 'border-gray-600 text-gray-300 hover:border-gray-400'}`}>
                                      👥
                                    </button>
                                  )}
                                  <button type="button" onClick={() => setAConfirmer(l.id)} title="Supprimer définitivement" aria-label={`Supprimer définitivement le diagnostic ${l.entreprise}`}
                                    className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition hover:border-red-700 hover:text-red-300">🗑️</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {lignesAffichees.length === 0 && (
                <p className="p-8 text-center text-gray-400">Aucun diagnostic ne correspond à ces filtres.</p>
              )}
            </>
          )}
        </section>

        {/* Diagnostics partagés par l'équipe */}
        {equipe && (
          <section id="partages" className="mt-8 rounded-xl border border-purple-800/60 bg-gray-800 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                👥 Partagés par votre équipe
                {partages.length > 0 && <span className="ml-2 rounded-full bg-purple-700 px-2 py-0.5 text-xs font-bold">{partages.length}</span>}
              </h2>
              <p className="text-xs text-gray-400">
                {equipe.nom} · vous êtes {infoRole(equipe.mon_role).emoji} {infoRole(equipe.mon_role).libelle}
              </p>
            </div>

            {!equipe.active ? (
              <p className="mt-3 text-sm text-amber-200">
                {etatLicence(equipe).titre}. <a href="/dashboard/equipe" className="underline">Voir la page Équipe</a>
              </p>
            ) : partages.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">
                Aucun diagnostic partagé pour l’instant.
                {!estViewer && ' Astuce : cliquez sur 👥 dans votre tableau pour partager un des vôtres.'}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-700">
                {partages.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{p.entreprise} <Badge statut={p.statut} /></p>
                      <p className="text-xs text-gray-400">
                        {[p.secteur, `par ${nomAuteur(p.user_id)}`, `mis à jour le ${dateCourte(p.updated_at)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`/diagnostic/${p.id}/voir`} aria-label={`Voir le diagnostic ${p.entreprise}`}
                        className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">👁️ Voir</a>
                      {equipe.mon_role === 'admin' && p.statut !== 'brouillon' && (
                        <a href={`/diagnostic/${p.id}/relecture`} aria-label={`Modifier le diagnostic ${p.entreprise} (Admin)`}
                          className="rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-500/10">✏️ Modifier</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <PiedDePageLegal className="mt-10" />
      </div>
    </main>
  )
}
