'use client'

// Page Paramètres du consultant : logo, couleur, lien de prise de RDV, signature, taux horaire.
// Les réglages sont enregistrés dans la table "profils" (une ligne par consultant).
//
// SAUVEGARDE AUTOMATIQUE :
// - 30 secondes après la DERNIÈRE modification, tout est envoyé à Supabase (c'est le "debounce" :
//   si vous tapez encore, le compte à rebours repart de 30 s).
// - À chaque modification, une copie de secours est gardée dans le navigateur (localStorage).
//   Si internet coupe ou si l'onglet se ferme, rien n'est perdu : la copie est reprise au retour.
// - Badge 🟢 Connecté / 🔴 Hors ligne en bas de l'écran.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { couleurSure, couleurTexteSur, finEmail, PROFIL_DEFAUT } from '../../lib/profil'
import { avecNouvellesTentatives, lireAttente, mettreEnAttente, viderAttente } from '../../lib/file-attente'

const DELAI_AUTOSAVE_MS = 30_000 // 30 secondes
const LOGO_MAX_OCTETS = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const inputClass =
  'mt-2 w-full rounded-lg border border-gray-500 bg-gray-700 px-4 py-3 text-white placeholder:italic placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400'

type Formulaire = {
  nom_complet: string
  nom_cabinet: string
  couleur_principale: string
  lien_calendly: string
  signature_email: string
  taux_horaire_defaut: string
}

const FORMULAIRE_VIDE: Formulaire = {
  nom_complet: '', nom_cabinet: '', couleur_principale: PROFIL_DEFAUT.couleur_principale,
  lien_calendly: '', signature_email: '', taux_horaire_defaut: '40',
}
const CHAMPS = Object.keys(FORMULAIRE_VIDE) as (keyof Formulaire)[]

// ---------------------------------------------------------------------------
// Petites fonctions utiles (en dehors du composant)
// ---------------------------------------------------------------------------

// Vérifie le formulaire et renvoie les erreurs + le taux converti en nombre
function verifier(form: Formulaire) {
  const erreurs: Partial<Record<keyof Formulaire, string>> = {}
  if (!/^#[0-9a-f]{6}$/i.test(form.couleur_principale)) erreurs.couleur_principale = 'Format attendu : #RRGGBB (ex. #2563eb).'
  const lien = form.lien_calendly.trim()
  if (lien && !/^https:\/\/[^\s]+$/i.test(lien)) {
    erreurs.lien_calendly = 'Le lien doit commencer par https:// (ex. https://calendly.com/votre-nom).'
  } else if (lien.length > 300) {
    erreurs.lien_calendly = '300 caractères maximum.'
  }
  const taux = Number(form.taux_horaire_defaut.replace(',', '.'))
  if (form.taux_horaire_defaut.trim() === '' || !Number.isFinite(taux) || taux < 0 || taux > 500) {
    erreurs.taux_horaire_defaut = 'Entre 0 et 500 €/h.'
  }
  if (form.signature_email.length > 1000) erreurs.signature_email = '1 000 caractères maximum.'
  return { erreurs, taux, valide: Object.keys(erreurs).length === 0 }
}

// Nom de la copie de secours dans le navigateur (une par consultant)
const cleCopie = (userId: string) => `parametres-${userId}`

// Ne garde que des textes (protège si la copie locale a été abîmée)
function nettoyerCopie(brut: unknown, base: Formulaire): Formulaire {
  const resultat = { ...base }
  if (brut && typeof brut === 'object') {
    for (const champ of CHAMPS) {
      const valeur = (brut as Record<string, unknown>)[champ]
      if (typeof valeur === 'string') resultat[champ] = valeur
    }
  }
  return resultat
}

// "à l'instant", "il y a 3 min", "il y a 2 h", "le 12/09"
function ilYA(date: Date, maintenant: number) {
  const minutes = Math.floor((maintenant - date.getTime()) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  return `le ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
}

// Connexion internet : React écoute les événements "online" / "offline" du navigateur
function abonnerConnexion(prevenir: () => void) {
  window.addEventListener('online', prevenir)
  window.addEventListener('offline', prevenir)
  return () => {
    window.removeEventListener('online', prevenir)
    window.removeEventListener('offline', prevenir)
  }
}

// ---------------------------------------------------------------------------
// Petits composants d'affichage
// ---------------------------------------------------------------------------

function Carte({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{titre}</h2>
      {sousTitre && <p className="mt-1 text-sm text-gray-400">{sousTitre}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
}

function BadgeConnexion({ enLigne }: { enLigne: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${enLigne ? 'border-green-700 bg-green-950/60 text-green-300' : 'border-red-700 bg-red-950/60 text-red-300'}`}>
      <span aria-hidden>{enLigne ? '🟢' : '🔴'}</span>
      {enLigne ? 'Connecté' : 'Hors ligne'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState('')
  const [essaiChargement, setEssaiChargement] = useState(0) // pour le bouton "Réessayer"

  const [form, setForm] = useState<Formulaire>(FORMULAIRE_VIDE)
  const [formServeur, setFormServeur] = useState<Formulaire>(FORMULAIRE_VIDE) // dernière version enregistrée
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [envoiLogo, setEnvoiLogo] = useState(false)
  const [erreur, setErreur] = useState('')
  const [copieRecuperee, setCopieRecuperee] = useState(false)

  // --- Suivi de la sauvegarde ---
  // "version" augmente à chaque modification ; "versionEnregistree" = dernière version envoyée avec succès.
  // Si les deux sont différentes → il reste des modifications non sauvegardées.
  const [version, setVersion] = useState(0)
  const [versionEnregistree, setVersionEnregistree] = useState(0)
  const [derniereModif, setDerniereModif] = useState(0) // moment de la dernière frappe (départ du compte à rebours)
  const [enCours, setEnCours] = useState(false)
  const [essai, setEssai] = useState({ numero: 1, total: 3 })
  const [echecEnvoi, setEchecEnvoi] = useState(false)
  const [derniereSauvegarde, setDerniereSauvegarde] = useState<Date | null>(null)
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const versionRef = useRef(0)
  const formRef = useRef<Formulaire>(FORMULAIRE_VIDE) // contenu le plus récent (lu par la sauvegarde)
  const enCoursRef = useRef(false)
  const aRelancerRef = useRef(false)
  const sortieAutoriseeRef = useRef(false)

  const enLigne = useSyncExternalStore(abonnerConnexion, () => navigator.onLine, () => true)
  const { erreurs, valide } = verifier(form)
  const nonSauvegarde = version !== versionEnregistree

  // --- Chargement des paramètres ---
  useEffect(() => {
    let annule = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const id = session.user.id
      const { data, error } = await supabase
        .from('profils')
        .select('nom_complet, nom_cabinet, logo_url, couleur_principale, lien_calendly, signature_email, taux_horaire_defaut, updated_at')
        .maybeSingle()
      if (annule) return

      const tableAbsente = error && /profils|relation|schema cache/i.test(error.message)
      if (error && !tableAbsente) {
        // On NE montre PAS le formulaire : sinon la sauvegarde automatique risquerait
        // d'écraser vos vrais paramètres avec des valeurs vides.
        console.error('[settings] Chargement impossible :', error)
        setErreurChargement('Impossible de charger vos paramètres. Vérifiez votre connexion internet puis réessayez.')
        setChargement(false)
        return
      }
      if (tableAbsente) {
        setErreur('La table des paramètres n’existe pas encore : exécutez le fichier supabase/04_parametres.sql dans Supabase.')
      }

      const depuisServeur: Formulaire = data
        ? {
            nom_complet: data.nom_complet ?? '',
            nom_cabinet: data.nom_cabinet ?? '',
            couleur_principale: couleurSure(data.couleur_principale),
            lien_calendly: data.lien_calendly ?? '',
            signature_email: data.signature_email ?? '',
            taux_horaire_defaut: String(data.taux_horaire_defaut ?? 40),
          }
        : FORMULAIRE_VIDE
      const dateServeur = data?.updated_at ? new Date(data.updated_at) : null

      // Une copie de secours plus récente que la dernière sauvegarde ? On la reprend.
      const copie = lireAttente<Formulaire>(cleCopie(id))
      const copieValable = copie && (!dateServeur || new Date(copie.date).getTime() > dateServeur.getTime())
      if (copie && copieValable) {
        versionRef.current = 1
        formRef.current = nettoyerCopie(copie.donnees, depuisServeur)
        setForm(formRef.current)
        setVersion(1)
        setDerniereModif(Date.now())
        setCopieRecuperee(true)
      } else {
        if (copie) viderAttente(cleCopie(id)) // copie périmée : le serveur a une version plus récente
        formRef.current = depuisServeur
        setForm(depuisServeur)
      }
      setFormServeur(depuisServeur)
      setLogoUrl(data?.logo_url ?? null)
      setDerniereSauvegarde(dateServeur)
      setUserId(id)
      setErreurChargement('')
      setChargement(false)
    }
    init()
    return () => { annule = true }
  }, [router, essaiChargement])

  // --- Une modification = nouvelle version + copie de secours + compte à rebours relancé ---
  function maj<K extends keyof Formulaire>(champ: K, valeur: Formulaire[K]) {
    const nouveau = { ...formRef.current, [champ]: valeur }
    formRef.current = nouveau
    setForm(nouveau)
    versionRef.current += 1
    setVersion(versionRef.current)
    setDerniereModif(Date.now())
    setEchecEnvoi(false)
    setCopieRecuperee(false)
    if (userId) mettreEnAttente(cleCopie(userId), { id: userId, donnees: nouveau, date: new Date().toISOString() })
  }

  // --- Envoi vers Supabase (avec 3 essais si le réseau hésite) ---
  async function enregistrer(): Promise<boolean> {
    if (!userId) return false
    // On lit toujours la version la plus récente du formulaire (et son numéro)
    const donnees = formRef.current
    const verif = verifier(donnees)
    if (!verif.valide) return false
    if (enCoursRef.current) {
      aRelancerRef.current = true // une sauvegarde est déjà en route : on refera un tour juste après
      return false
    }
    enCoursRef.current = true
    const versionEnvoyee = versionRef.current
    setEnCours(true)
    setErreur('')
    let ok = false
    try {
      await avecNouvellesTentatives(async () => {
        // "upsert" = crée la ligne si elle n'existe pas, sinon la met à jour.
        // Le logo n'est pas dans la liste : il est enregistré à part, dès l'import.
        const { error } = await supabase.from('profils').upsert({
          id: userId,
          nom_complet: donnees.nom_complet.trim() || null,
          nom_cabinet: donnees.nom_cabinet.trim() || null,
          couleur_principale: donnees.couleur_principale.toLowerCase(),
          lien_calendly: donnees.lien_calendly.trim() || null,
          signature_email: donnees.signature_email.trim() || null,
          taux_horaire_defaut: verif.taux,
        })
        if (error) throw error
      }, (numero, total) => setEssai({ numero, total }))
      ok = true
      setVersionEnregistree((v) => Math.max(v, versionEnvoyee))
      setFormServeur(donnees)
      setDerniereSauvegarde(new Date())
      setEchecEnvoi(false)
      setCopieRecuperee(false)
      // On efface la copie de secours seulement si rien n'a bougé pendant l'envoi
      if (versionRef.current === versionEnvoyee) viderAttente(cleCopie(userId))
    } catch (e) {
      console.error('[settings] Enregistrement impossible :', e)
      const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '')
      setEchecEnvoi(true)
      setErreur(/profils|relation|schema cache/i.test(message)
        ? 'La table des paramètres n’existe pas encore : exécutez le fichier supabase/04_parametres.sql dans Supabase.'
        : 'L’enregistrement a échoué. Vos modifications sont gardées sur cet ordinateur : réessayez dans un instant.')
    } finally {
      enCoursRef.current = false
      setEnCours(false)
      setEssai({ numero: 1, total: 3 })
    }
    if (aRelancerRef.current) {
      aRelancerRef.current = false
      setTimeout(() => { void enregistrerRef.current() }, 0) // avec les valeurs les plus récentes
    }
    return ok
  }

  // Les minuteries appellent toujours la version la plus récente de "enregistrer"
  const enregistrerRef = useRef(enregistrer)
  useEffect(() => { enregistrerRef.current = enregistrer })

  // --- LA SAUVEGARDE AUTOMATIQUE (debounce de 30 s) ---
  // Chaque modification change "derniereModif" : l'ancienne minuterie est annulée et une nouvelle démarre.
  useEffect(() => {
    if (!userId || !nonSauvegarde || !valide || !enLigne || echecEnvoi) return
    const reste = Math.max(0, derniereModif + DELAI_AUTOSAVE_MS - Date.now())
    const minuterie = setTimeout(() => { void enregistrerRef.current() }, reste)
    return () => clearTimeout(minuterie)
  }, [userId, nonSauvegarde, valide, enLigne, echecEnvoi, derniereModif])

  // Au retour d'internet après un échec : on retente tout seul
  useEffect(() => {
    if (!enLigne || !echecEnvoi || !nonSauvegarde) return
    const minuterie = setTimeout(() => { void enregistrerRef.current() }, 1000)
    return () => clearTimeout(minuterie)
  }, [enLigne, echecEnvoi, nonSauvegarde])

  // Horloge : fait avancer le compte à rebours et le "il y a X min"
  useEffect(() => {
    const horloge = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(horloge)
  }, [])

  // Ctrl+S (ou Cmd+S sur Mac) = enregistrer tout de suite
  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void enregistrerRef.current()
      }
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [])

  // Avertissement si on ferme l'onglet avec des modifications pas encore envoyées
  const nonSauvegardeRef = useRef(false)
  useEffect(() => { nonSauvegardeRef.current = nonSauvegarde })
  useEffect(() => {
    function avantFermeture(e: BeforeUnloadEvent) {
      if (nonSauvegardeRef.current && !sortieAutoriseeRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', avantFermeture)
    return () => window.removeEventListener('beforeunload', avantFermeture)
  }, [])

  // Quitter la page : on enregistre d'abord ce qui reste
  const quitter = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>, destination: string) => {
    if (!nonSauvegarde) return // rien en attente : on laisse le lien faire son travail
    e.preventDefault()
    const ok = valide && enLigne ? await enregistrerRef.current() : false
    if (ok || window.confirm('Certaines modifications ne sont pas encore enregistrées en ligne (une copie est gardée sur cet ordinateur).\n\nQuitter quand même ?')) {
      sortieAutoriseeRef.current = true
      window.location.href = destination
    }
  }, [nonSauvegarde, valide, enLigne])

  // Annuler la copie récupérée : on revient à la version enregistrée
  function ignorerCopie() {
    if (userId) viderAttente(cleCopie(userId))
    formRef.current = formServeur
    setForm(formServeur)
    setVersionEnregistree(versionRef.current)
    setVersion(versionRef.current)
    setCopieRecuperee(false)
    setEchecEnvoi(false)
  }

  // --- Logo : envoi dans Supabase Storage (dossier logos/<id du consultant>/), enregistré tout de suite ---
  async function enregistrerLogo(url: string | null) {
    if (!userId) return false
    const { error } = await supabase.from('profils').upsert({ id: userId, logo_url: url })
    if (error) {
      console.error('[settings] Enregistrement du logo impossible :', error)
      setErreur('Le logo n’a pas pu être enregistré. Vérifiez votre connexion et réessayez.')
      return false
    }
    return true
  }

  async function envoyerLogo(fichier: File | undefined) {
    if (!fichier || !userId) return
    setErreur('')
    if (!enLigne) {
      setErreur('Internet est coupé : l’import du logo a besoin d’internet.')
      return
    }
    if (!LOGO_TYPES.includes(fichier.type)) {
      setErreur('Format non accepté : utilisez une image PNG, JPEG ou WebP.')
      return
    }
    if (fichier.size > LOGO_MAX_OCTETS) {
      setErreur('Image trop lourde : 2 Mo maximum.')
      return
    }

    setEnvoiLogo(true)
    const extension = fichier.type === 'image/png' ? 'png' : fichier.type === 'image/webp' ? 'webp' : 'jpg'
    // Nom unique à chaque envoi : évite que l'ancien logo reste affiché (cache du navigateur)
    const chemin = `${userId}/logo-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('logos').upload(chemin, fichier, { contentType: fichier.type, upsert: true })
    if (error) {
      console.error('[settings] Envoi du logo impossible :', error)
      setErreur('L’envoi du logo a échoué. Vérifiez que le fichier supabase/04_parametres.sql a bien été exécuté.')
      setEnvoiLogo(false)
      return
    }
    const ancien = logoUrl
    const { data } = supabase.storage.from('logos').getPublicUrl(chemin)
    const ok = await enregistrerLogo(data.publicUrl)
    if (ok) {
      setLogoUrl(data.publicUrl)
      if (ancien) await supprimerFichier(ancien) // on fait le ménage : l'ancien logo ne sert plus
    } else {
      await supprimerFichier(data.publicUrl) // pas enregistré : on retire le fichier envoyé pour rien
    }
    setEnvoiLogo(false)
  }

  async function supprimerFichier(url: string) {
    const morceau = url.split('/logos/')[1] // ex. "<id>/logo-123.png"
    if (morceau) await supabase.storage.from('logos').remove([decodeURIComponent(morceau)])
  }

  async function retirerLogo() {
    if (!logoUrl) return
    const ancien = logoUrl
    setEnvoiLogo(true)
    const ok = await enregistrerLogo(null)
    if (ok) {
      setLogoUrl(null)
      await supprimerFichier(ancien)
    }
    setEnvoiLogo(false)
  }

  // --- Aperçus ---
  const couleur = couleurSure(form.couleur_principale)
  const texteBouton = couleurTexteSur(couleur)
  const apercuFin = finEmail({
    ...PROFIL_DEFAUT,
    nom_complet: form.nom_complet,
    lien_calendly: form.lien_calendly.trim(),
    signature_email: form.signature_email,
  })
  const secondesRestantes = Math.max(0, Math.ceil((derniereModif + DELAI_AUTOSAVE_MS - maintenant) / 1000))

  // --- Écrans d'attente / d'erreur ---
  if (chargement) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black text-gray-400">
        <Spinner /> <span className="ml-3">Chargement…</span>
      </main>
    )
  }
  if (erreurChargement) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
        <div className="max-w-md rounded-xl border border-red-700 bg-red-950/60 p-6 text-center">
          <p role="alert" className="text-red-100">⚠️ {erreurChargement}</p>
          <div className="mt-4 flex justify-center">
            <BadgeConnexion enLigne={enLigne} />
          </div>
          <button type="button" onClick={() => { setChargement(true); setEssaiChargement((n) => n + 1) }}
            className="mt-5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-700">
            🔄 Réessayer
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pb-36 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between border-b border-gray-800 pb-6">
          <a href="/dashboard" onClick={(e) => quitter(e, '/dashboard')} className="text-lg font-bold text-blue-400">Diagnostic IA</a>
          <a href="/dashboard" onClick={(e) => quitter(e, '/dashboard')} className="text-sm text-gray-400 transition hover:text-white">← Tableau de bord</a>
        </header>

        <h1 className="text-3xl font-bold sm:text-4xl">⚙️ Paramètres</h1>
        <p className="mt-3 text-gray-400">
          Votre image de marque et vos réglages par défaut, utilisés dans les rapports et les emails.
          <span className="block text-sm text-gray-500">Enregistrement automatique 30 secondes après votre dernière modification · Ctrl+S pour enregistrer tout de suite.</span>
        </p>

        {/* Bandeau : internet coupé */}
        {!enLigne && (
          <div role="status" className="mt-6 rounded-xl border border-amber-600 bg-amber-950/60 p-4 text-sm text-amber-100">
            <p className="font-semibold">⚠️ Internet coupé — sauvegarde en attente</p>
            <p className="mt-1">Vos modifications sont gardées sur cet ordinateur. Elles seront envoyées dès le retour de la connexion.</p>
          </div>
        )}

        {/* Bandeau : copie de secours récupérée */}
        {copieRecuperee && (
          <div role="status" className="mt-6 flex flex-col gap-3 rounded-xl border border-blue-600 bg-blue-950/60 p-4 text-sm text-blue-100 sm:flex-row sm:items-center sm:justify-between">
            <p>♻️ Des modifications non enregistrées ont été retrouvées sur cet ordinateur et remises dans le formulaire. Elles seront enregistrées automatiquement.</p>
            <button type="button" onClick={ignorerCopie}
              className="shrink-0 rounded-lg border border-blue-400 px-4 py-2 font-semibold text-blue-100 transition hover:bg-blue-500/20">
              Revenir à la version enregistrée
            </button>
          </div>
        )}

        {erreur && (
          <p role="alert" className="mt-6 rounded-lg border border-red-700 bg-red-950/70 p-4 text-sm text-red-200">⚠️ {erreur}</p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Identité */}
          <Carte titre="Votre identité" sousTitre="Affichée sur le rapport client et dans les emails">
            <label className="block text-sm font-medium text-gray-200">
              Nom complet
              <input className={inputClass} value={form.nom_complet} maxLength={120} placeholder="ex. : Fawzi Martin"
                onChange={(e) => maj('nom_complet', e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-200">
              Nom du cabinet / de l’entreprise
              <input className={inputClass} value={form.nom_cabinet} maxLength={120} placeholder="ex. : FM Conseil"
                onChange={(e) => maj('nom_cabinet', e.target.value)} />
            </label>
          </Carte>

          {/* Logo */}
          <Carte titre="Logo" sousTitre="PNG, JPEG ou WebP · 2 Mo maximum · fond transparent conseillé">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-48 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-600 bg-gray-900">
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="Votre logo" className="max-h-20 max-w-44 object-contain" />
                  : <span className="text-xs text-gray-400">Aucun logo</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-400 hover:bg-blue-500/20 ${envoiLogo ? 'pointer-events-none opacity-60' : ''}`}>
                  {envoiLogo ? <Spinner /> : <span aria-hidden>🖼️</span>}
                  {envoiLogo ? 'Envoi…' : logoUrl ? 'Changer le logo' : 'Importer un logo'}
                  <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={envoiLogo}
                    onChange={(e) => { envoyerLogo(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                {logoUrl && (
                  <button type="button" onClick={retirerLogo} disabled={envoiLogo}
                    className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm text-gray-300 transition hover:border-red-700 hover:text-red-300 disabled:opacity-50">
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">Le logo est enregistré dès l’import (internet nécessaire).</p>
          </Carte>

          {/* Couleur */}
          <Carte titre="Couleur principale" sousTitre="Pour le rapport client et le PDF">
            <div className="flex items-center gap-3">
              <input type="color" value={couleur} onChange={(e) => maj('couleur_principale', e.target.value)}
                aria-label="Choisir la couleur" className="h-12 w-16 cursor-pointer rounded-lg border border-gray-500 bg-gray-700 p-1" />
              <input className={`${inputClass} mt-0 font-mono uppercase`} value={form.couleur_principale} maxLength={7}
                onChange={(e) => maj('couleur_principale', e.target.value.trim())} aria-label="Code couleur (format #RRGGBB)"
                aria-invalid={erreurs.couleur_principale ? true : undefined} aria-describedby={erreurs.couleur_principale ? 'erreur-couleur' : undefined} />
            </div>
            {erreurs.couleur_principale && <p id="erreur-couleur" className="text-xs text-red-400">⚠ {erreurs.couleur_principale}</p>}
            <div className="rounded-lg bg-gray-900 p-4">
              <p className="text-xs text-gray-400">Aperçu</p>
              <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: couleur }} />
              <span className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: couleur, color: texteBouton }}>
                📅 Prendre rendez-vous
              </span>
            </div>
          </Carte>

          {/* Rendez-vous + taux */}
          <Carte titre="Rendez-vous et tarif">
            <label className="block text-sm font-medium text-gray-200">
              Lien Calendly / Cal.com
              <input className={inputClass} value={form.lien_calendly} maxLength={300}
                aria-invalid={erreurs.lien_calendly ? true : undefined} aria-describedby="aide-calendly" placeholder="ex. : https://calendly.com/votre-nom/30min" inputMode="url"
                onChange={(e) => maj('lien_calendly', e.target.value)} />
              {erreurs.lien_calendly
                ? <span id="aide-calendly" className="mt-1 block text-xs text-red-400">⚠ {erreurs.lien_calendly}</span>
                : <span id="aide-calendly" className="mt-1 block text-xs text-gray-400">Ajouté dans vos emails et en bouton sur le rapport client.</span>}
            </label>
            <label className="block text-sm font-medium text-gray-200">
              Taux horaire par défaut (€/h)
              <input className={inputClass} value={form.taux_horaire_defaut} inputMode="decimal" placeholder="ex. : 40"
                aria-invalid={erreurs.taux_horaire_defaut ? true : undefined} aria-describedby="aide-taux"
                onChange={(e) => maj('taux_horaire_defaut', e.target.value)} />
              {erreurs.taux_horaire_defaut
                ? <span id="aide-taux" className="mt-1 block text-xs text-red-400">⚠ {erreurs.taux_horaire_defaut}</span>
                : <span id="aide-taux" className="mt-1 block text-xs text-gray-400">Pré-rempli dans chaque nouveau diagnostic (modifiable au cas par cas).</span>}
            </label>
          </Carte>

          {/* Signature */}
          <section className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">Signature email</h2>
            <p className="mt-1 text-sm text-gray-400">Ajoutée automatiquement à la fin de l’email d’envoi du rapport et des relances.</p>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <label className="block text-sm font-medium text-gray-200">
                Votre signature
                <textarea className={`${inputClass} min-h-40 resize-y text-sm leading-6`} value={form.signature_email} maxLength={1000}
                  placeholder={'ex. :\nFawzi Martin\nConsultant en transformation digitale\n06 12 34 56 78'}
                  aria-invalid={erreurs.signature_email ? true : undefined}
                  onChange={(e) => maj('signature_email', e.target.value)} />
                {erreurs.signature_email && <span className="mt-1 block text-xs text-red-400">{erreurs.signature_email}</span>}
              </label>
              <div>
                <p className="text-sm font-medium text-gray-200">Aperçu de la fin de vos emails</p>
                <pre className="mt-2 min-h-40 whitespace-pre-wrap rounded-lg border border-gray-700 bg-gray-900 p-4 font-sans text-sm leading-6 text-gray-300">
                  {'Bien cordialement,'}{apercuFin || '\n\n(signature vide)'}
                </pre>
              </div>
            </div>
          </section>
        </div>

        {/* Barre de sauvegarde (toujours visible en bas) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-800 bg-gray-950/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <BadgeConnexion enLigne={enLigne} />
              <div className="min-w-0 text-sm">
                {/* Ce texte est lu par les lecteurs d'écran à chaque changement d'état */}
                <p role="status" aria-live="polite" className="font-medium">
                  {enCours
                    ? <span className="flex items-center gap-2 text-gray-200"><Spinner /> 💾 Enregistrement…{essai.numero > 1 && ` (essai ${essai.numero}/${essai.total})`}</span>
                    : !nonSauvegarde
                      ? <span className="text-green-400">✅ Enregistré</span>
                      : <span className="text-amber-300">⚠️ Non sauvegardé</span>}
                </p>
                {/* Détail (pas lu à voix haute à chaque seconde) */}
                <p className="text-xs text-gray-400" aria-hidden={!enCours && nonSauvegarde && valide && enLigne && !echecEnvoi ? true : undefined}>
                  {enCours
                    ? 'Envoi de vos paramètres…'
                    : !nonSauvegarde
                      ? derniereSauvegarde ? `Dernière sauvegarde ${ilYA(derniereSauvegarde, maintenant)}` : 'Aucune modification'
                      : !valide
                        ? 'Corrigez les champs en rouge pour permettre la sauvegarde.'
                        : !enLigne
                          ? 'Copie gardée sur cet ordinateur · envoi au retour d’internet.'
                          : echecEnvoi
                            ? 'Échec de l’envoi · copie gardée sur cet ordinateur.'
                            : `Sauvegarde automatique dans ${secondesRestantes} s`}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => { void enregistrer() }} disabled={!nonSauvegarde || !valide || enCours || !enLigne}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              💾 Enregistrer maintenant
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
