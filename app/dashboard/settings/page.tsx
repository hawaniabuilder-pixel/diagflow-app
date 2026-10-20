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
import LogoUpload from '../../components/LogoUpload'
import { changerModeDemo, useModeDemo } from '../../lib/mode-demo'
import TemplateSelector from '../../components/TemplateSelector'
import { chargerTemplateDefaut, enregistrerTemplateDefaut } from '../../lib/template-profil'
import { TEMPLATE_PAR_DEFAUT, TEMPLATES, type TemplateId } from '../../lib/templates'
import { chargerUtilisationIA, dateRenouvellement, NOMS_OFFRES, type UtilisationIA } from '../../lib/quota'
import {
  actualiserAbonnementSolo, chargerAbonnementSolo, ouvrirEspaceClientSolo, payerOffreSolo, texteAbonnement, type Abonnement,
} from '../../lib/paiement'
import { ANALYSES_IA_INCLUSES, ANALYSES_OFFERTES_ESSAI, PLACES_OFFRE_EQUIPE, PRIX_OFFRE_EQUIPE, TARIF_SOLO_MENSUEL } from '../../lib/entreprise'
import { exporterMesDonnees, supprimerMonCompte } from '../../lib/compte'

const DELAI_AUTOSAVE_MS = 30_000 // 30 secondes

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

// Une des 3 offres affichées dans « 💳 Mon offre » (l'offre actuelle est entourée en vert)
function CarteOffre({ titre, prix, details, actuelle, children }: {
  titre: string; prix: string; details: string[]; actuelle: boolean; children?: React.ReactNode
}) {
  return (
    <div className={`flex flex-col rounded-lg border p-4 ${actuelle ? 'border-green-500 bg-green-950/30' : 'border-gray-600 bg-gray-900/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{titre}</p>
        {actuelle && <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">✓ Votre offre</span>}
      </div>
      <p className="mt-1 text-xl font-bold">{prix}</p>
      <ul className="mt-2 flex-1 space-y-1 text-sm text-gray-300">
        {details.map((d) => <li key={d}>✓ {d}</li>)}
      </ul>
      {children && <div className="mt-4">{children}</div>}
    </div>
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
  const modeDemo = useModeDemo() // 🧪 réglage gardé dans ce navigateur (localStorage)
  // Template de rapport par défaut (enregistré tout de suite, à part de la sauvegarde automatique)
  const [templateDefaut, setTemplateDefaut] = useState<TemplateId>(TEMPLATE_PAR_DEFAUT)
  const [etatTemplate, setEtatTemplate] = useState<{ type: 'ok' | 'erreur' | 'enCours'; texte: string } | null>(null)
  // Analyses IA du mois (quota) et « Mes données » (RGPD)
  const [utilisationIA, setUtilisationIA] = useState<UtilisationIA | null>(null)
  // 💳 Mon offre (Essai gratuit / Solo 29 € / Équipe / sur mesure)
  const [abonnementSolo, setAbonnementSolo] = useState<Abonnement | null>(null)
  const [actionOffre, setActionOffre] = useState<'payer' | 'portail' | 'actualiser' | null>(null)
  const [messageOffre, setMessageOffre] = useState<{ type: 'info' | 'ok' | 'erreur'; texte: string } | null>(null)
  const [confirmationSuppression, setConfirmationSuppression] = useState('')
  const [actionCompte, setActionCompte] = useState<'export' | 'suppression' | null>(null)
  const [erreurCompte, setErreurCompte] = useState('')
  const { erreurs, valide } = verifier(form)
  const nonSauvegarde = version !== versionEnregistree
  // 💳 L'offre actuelle (null tant que le compteur ne répond pas) et le bouton « Passer en Solo »
  const offreActuelle = utilisationIA?.offre ?? null
  const peutPrendreSolo = !offreActuelle || offreActuelle === 'essai'

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
      // Template par défaut (colonne ajoutée par supabase/08_templates.sql)
      const [choix, utilisation, solo] = await Promise.all([chargerTemplateDefaut(), chargerUtilisationIA(), chargerAbonnementSolo()])
      if (annule) return
      setUtilisationIA(utilisation)
      setAbonnementSolo(solo)
      setTemplateDefaut(choix.template)
      if (!choix.disponible) setEtatTemplate({ type: 'erreur', texte: 'Exécutez supabase/08_templates.sql dans Supabase pour enregistrer ce choix.' })
      setErreurChargement('')
      setChargement(false)
    }
    init()
    return () => { annule = true }
  }, [router, essaiChargement])

  // --- Retour de la page de paiement Stripe (?paiement=reussi / annule / portail) ---
  useEffect(() => {
    const retour = new URLSearchParams(window.location.search).get('paiement')
    if (!retour) return
    window.history.replaceState(null, '', '/dashboard/settings#mon-offre')
    async function traiterRetour() {
      if (retour === 'annule') {
        setMessageOffre({ type: 'info', texte: 'Paiement annulé : rien n’a été prélevé.' })
        return
      }
      if (retour === 'reussi') setMessageOffre({ type: 'info', texte: '⏳ Vérification du paiement auprès de Stripe…' })
      setActionOffre('actualiser')
      const { abonnement, erreur: probleme } = await actualiserAbonnementSolo()
      setAbonnementSolo(abonnement)
      setUtilisationIA(await chargerUtilisationIA())
      setActionOffre(null)
      if (probleme) setMessageOffre({ type: 'erreur', texte: probleme })
      else if (retour === 'reussi') setMessageOffre({ type: 'ok', texte: '🎉 Bienvenue dans l’offre Solo ! Vous avez maintenant 30 analyses IA par mois.' })
      else setMessageOffre(null)
      setTimeout(() => document.getElementById('mon-offre')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
    traiterRetour()
  }, [])

  async function passerEnSolo() {
    setMessageOffre(null)
    setActionOffre('payer')
    const probleme = await payerOffreSolo() // part vers Stripe si tout va bien
    if (probleme) {
      setActionOffre(null)
      setMessageOffre({ type: 'erreur', texte: probleme })
    }
  }

  async function gererAbonnementSolo() {
    setMessageOffre(null)
    setActionOffre('portail')
    const probleme = await ouvrirEspaceClientSolo()
    if (probleme) {
      setActionOffre(null)
      setMessageOffre({ type: 'erreur', texte: probleme })
    }
  }

  async function actualiserOffre() {
    setMessageOffre(null)
    setActionOffre('actualiser')
    const { abonnement, erreur: probleme } = await actualiserAbonnementSolo()
    setAbonnementSolo(abonnement)
    setUtilisationIA(await chargerUtilisationIA())
    setActionOffre(null)
    setMessageOffre(probleme ? { type: 'erreur', texte: probleme } : { type: 'ok', texte: '🔄 Offre actualisée.' })
  }

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

  // Choix du template par défaut : enregistré immédiatement
  async function changerTemplateDefaut(t: TemplateId) {
    if (!userId || t === templateDefaut) return
    const precedent = templateDefaut
    setTemplateDefaut(t)
    setEtatTemplate({ type: 'enCours', texte: 'Enregistrement…' })
    const probleme = await enregistrerTemplateDefaut(userId, t)
    if (probleme) {
      setTemplateDefaut(precedent)
      setEtatTemplate({ type: 'erreur', texte: probleme })
    } else {
      setEtatTemplate({ type: 'ok', texte: `✅ « ${TEMPLATES[t].nom} » sera proposé pour vos prochains diagnostics.` })
    }
  }

  // --- Mes données (RGPD) ---
  async function telechargerMesDonnees() {
    setErreurCompte('')
    setActionCompte('export')
    const ok = await exporterMesDonnees()
    setActionCompte(null)
    if (!ok) setErreurCompte('Le téléchargement a échoué. Reconnectez-vous puis réessayez.')
  }

  async function supprimerCompte() {
    if (confirmationSuppression.trim().toUpperCase() !== 'SUPPRIMER') return
    if (!window.confirm('Dernière vérification : votre compte et TOUTES vos données seront effacés, sans retour possible. Continuer ?')) return
    setErreurCompte('')
    setActionCompte('suppression')
    const probleme = await supprimerMonCompte()
    if (probleme) {
      setActionCompte(null)
      setErreurCompte(probleme)
      return
    }
    sortieAutoriseeRef.current = true
    window.location.href = '/'
  }

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

  // --- Logo : le composant LogoUpload envoie l'image dans Supabase Storage,
  // puis appelle cette fonction pour ranger son adresse dans le profil (null = logo supprimé).
  async function enregistrerLogo(url: string | null) {
    if (!userId) return false
    const { error } = await supabase.from('profils').upsert({ id: userId, logo_url: url })
    if (error) {
      console.error('[settings] Enregistrement du logo impossible :', error)
      return false
    }
    setLogoUrl(url)
    return true
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
            className="mt-5 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold transition hover:bg-orange-600">
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
          <a href="/dashboard" onClick={(e) => quitter(e, '/dashboard')} className="text-lg font-bold text-blue-400">Vizion</a>
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
          <Carte titre="Logo" sousTitre="Affiché en haut du rapport client et du PDF">
            {userId && <LogoUpload userId={userId} logoUrl={logoUrl} enregistrer={enregistrerLogo} enLigne={enLigne} />}
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

          {/* 📄 Templates de rapport : Express / Complet / Premium */}
          <section id="templates" className="scroll-mt-20 rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">📄 Template de rapport par défaut</h2>
            <p className="mt-1 text-sm text-gray-400">
              Le format proposé pour chaque nouveau diagnostic (vous pouvez le changer client par client). Il change ce que l’IA rédige,
              et son prix conseillé remplit le « Prix facturé » s’il est encore vide.
            </p>
            <div className="mt-6">
              <TemplateSelector valeur={templateDefaut} onChange={changerTemplateDefaut} nom="template-defaut"
                desactive={etatTemplate?.type === 'enCours'} />
            </div>
            <p aria-live="polite" className={`mt-4 min-h-5 text-sm ${etatTemplate?.type === 'erreur' ? 'text-amber-300' : etatTemplate?.type === 'ok' ? 'text-green-400' : 'text-gray-400'}`}>
              {etatTemplate?.texte}
            </p>
          </section>

          {/* 💳 Mon offre : compteur d'analyses IA + les 3 offres (toujours visibles) */}
          <section id="mon-offre" className="scroll-mt-20 rounded-xl border border-blue-700 bg-gray-800 p-5 sm:p-6 lg:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                💳 Mon offre{offreActuelle ? ` : ${NOMS_OFFRES[offreActuelle]}` : ''}
              </h2>
              {utilisationIA && (
                <p className="text-sm text-gray-300">
                  <strong className={utilisationIA.restantes === 0 ? 'text-red-300' : 'text-white'}>{utilisationIA.restantes}</strong>
                  {' '}analyse{utilisationIA.restantes > 1 ? 's' : ''} IA {offreActuelle === 'essai' ? 'offerte' : 'restante'}{utilisationIA.restantes > 1 ? 's' : ''}
                  {' '}sur {utilisationIA.quota}{offreActuelle === 'essai' ? '' : ' ce mois-ci'}
                </p>
              )}
            </div>

            {utilisationIA ? (
              <>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-700" role="progressbar" aria-label="Analyses IA utilisées"
                  aria-valuemin={0} aria-valuemax={utilisationIA.quota} aria-valuenow={utilisationIA.utilisees}>
                  <div className={`h-full rounded-full ${utilisationIA.restantes === 0 ? 'bg-red-500' : utilisationIA.restantes <= Math.ceil(utilisationIA.quota / 6) ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (utilisationIA.utilisees / Math.max(1, utilisationIA.quota)) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  {utilisationIA.renouvellement
                    ? `Le compteur repart à zéro le ${dateRenouvellement(utilisationIA.renouvellement)}. `

                    : 'Les analyses offertes ne se renouvellent pas. '}
                  Une analyse qui échoue n’est pas comptée, et le 🧪 Mode Démo est illimité.
                </p>
                <div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-900/20 px-4 py-3 text-sm"> <strong>OFFRE FONDATEURS (jusqu'au 11/11) :</strong> Solo à <strong>19 € HT/mois À VIE</strong> (au lieu de 29 €) pour les 30 premiers + accompagnements −100 € et bonus. <a href="/accompagnement" className="font-bold text-emerald-300 underline">Réserver ma place Fondateur →</a></div>
              </>
            ) : (
              <p className="mt-2 text-sm text-amber-200">
                ⚠️ Le compteur d’analyses ne répond pas. Rechargez la page (F5). Si le message reste, exécutez{' '}
                <code>supabase/10_quota_et_compte.sql</code> puis <code>supabase/13_offres.sql</code> dans Supabase.
              </p>
            )}

            {messageOffre && (
              <p role={messageOffre.type === 'erreur' ? 'alert' : 'status'}
                className={`mt-4 rounded-lg border p-3 text-sm ${messageOffre.type === 'erreur' ? 'border-red-700 bg-red-950/60 text-red-200' : messageOffre.type === 'ok' ? 'border-green-700 bg-green-950/60 text-green-200' : 'border-gray-600 bg-gray-900/60 text-gray-200'}`}>
                {messageOffre.texte}
              </p>
            )}

            {/* Les 3 offres, côte à côte : on voit toujours où on en est et ce qu'on peut prendre */}
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <CarteOffre titre="🎁 Essai gratuit" prix="0 €" actuelle={offreActuelle === 'essai'}
                details={[`${ANALYSES_OFFERTES_ESSAI} analyses IA offertes`, 'Mode démo illimité', 'Sans carte bancaire']} />

              <CarteOffre titre="💼 Solo" prix={`${TARIF_SOLO_MENSUEL ?? 29} € HT / mois`} actuelle={offreActuelle === 'solo'}
                details={[`${ANALYSES_IA_INCLUSES} analyses IA par mois`, 'Les 3 formats de rapport', 'Sans engagement']}>
                {peutPrendreSolo && (
                  <button type="button" onClick={passerEnSolo} disabled={actionOffre !== null}
                    className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold transition hover:bg-orange-600 disabled:opacity-50">
                    {actionOffre === 'payer' ? 'Ouverture de Stripe…' : `💳 Passer en Solo — ${TARIF_SOLO_MENSUEL ?? 29} €/mois`}
                  </button>
                )}
                {offreActuelle === 'equipe' && <p className="text-xs text-gray-400">Inutile : vos analyses sont incluses dans votre équipe.</p>}
              </CarteOffre>

              <CarteOffre titre="👥 Équipe" prix={`${PRIX_OFFRE_EQUIPE} € HT / mois`} actuelle={offreActuelle === 'equipe'}
                details={[`${PLACES_OFFRE_EQUIPE} consultants`, `${ANALYSES_IA_INCLUSES} analyses IA par mois chacun`, 'Partage des diagnostics']}>
                <a href="/dashboard/equipe" onClick={(e) => quitter(e, '/dashboard/equipe')}
                  className="block w-full rounded-lg border border-purple-500 bg-purple-500/10 px-4 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20">
                  {offreActuelle === 'equipe' ? 'Voir mon équipe →' : 'Découvrir l’offre Équipe →'}
                </a>
              </CarteOffre>
            </div>

            {offreActuelle === 'sur_mesure' && (
              <p className="mt-4 text-sm text-gray-300">⭐ Vous avez une offre sur mesure. Pour la modifier, contactez-nous.</p>
            )}

            {/* Abonnement Solo : état + gestion */}
            {abonnementSolo?.stripe_customer_id && offreActuelle !== 'equipe' && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {abonnementSolo.statut && <span className="text-gray-300">{texteAbonnement(abonnementSolo).texte}</span>}
                <button type="button" onClick={gererAbonnementSolo} disabled={actionOffre !== null}
                  className="rounded-lg border border-gray-500 px-3 py-2 text-xs font-semibold text-gray-100 transition hover:border-gray-300 disabled:opacity-50">
                  {actionOffre === 'portail' ? 'Ouverture…' : '🧾 Gérer mon abonnement'}
                </button>
                <button type="button" onClick={actualiserOffre} disabled={actionOffre !== null}
                  className="text-xs text-gray-400 underline transition hover:text-white disabled:opacity-50">
                  {actionOffre === 'actualiser' ? 'Actualisation…' : '🔄 Actualiser'}
                </button>
              </div>
            )}
          </section>

          {/* 🧪 Mode Démo : réglage immédiat, gardé dans ce navigateur (pas besoin d'enregistrer) */}
          <section id="mode-demo" className={`scroll-mt-20 rounded-xl border p-5 sm:p-6 lg:col-span-2 ${modeDemo ? 'border-purple-500 bg-purple-950/40' : 'border-gray-700 bg-gray-800'}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="titre-mode-demo" className="text-lg font-semibold">🧪 Mode Démo</h2>
                <p className="mt-1 text-sm text-gray-300">
                  Testez l’outil ou faites une démonstration <strong>sans crédit IA</strong> : l’analyse est simulée avec des données fictives, sans aucun appel à l’IA.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-400">
                  <li>✓ Nouveau diagnostic pré-rempli avec une entreprise fictive</li>
                  <li>✓ Analyse « IA » simulée en quelques secondes, gratuite</li>
                  <li>✓ Bandeau « MODE DÉMO » en haut des pages de votre espace</li>
                  <li>✓ Réglage gardé sur ce navigateur uniquement</li>
                </ul>
              </div>
              {/* Interrupteur (role="switch" : les lecteurs d'écran annoncent « activé / désactivé ») */}
              <button type="button" role="switch" aria-checked={modeDemo} aria-labelledby="titre-mode-demo"
                onClick={() => changerModeDemo(!modeDemo)}
                className="inline-flex shrink-0 items-center gap-3 self-start rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900">
                <span className={`relative inline-block h-8 w-14 rounded-full transition ${modeDemo ? 'bg-purple-500' : 'bg-gray-600'}`}>
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${modeDemo ? 'left-7' : 'left-1'}`} />
                </span>
                <span className={`text-sm font-semibold ${modeDemo ? 'text-purple-200' : 'text-gray-300'}`}>{modeDemo ? 'Activé' : 'Désactivé'}</span>
              </button>
            </div>
            {modeDemo && (
              <p className="mt-4 rounded-lg bg-gray-900/70 p-3 text-sm text-purple-100">
                👉 Pour essayer : <a href="/diagnostic" onClick={(e) => quitter(e, '/diagnostic')} className="font-semibold underline">Nouveau diagnostic</a>, cochez la case RGPD, puis « Générer l’analyse (démo) ».
                Les diagnostics de démo sont de vrais brouillons : supprimez-les ensuite depuis le tableau de bord.
              </p>
            )}
          </section>

          {/* Équipe */}
          <section className="flex flex-col gap-4 rounded-xl border border-purple-800/60 bg-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:col-span-2">
            <div>
              <h2 className="text-lg font-semibold">👥 Équipe</h2>
              <p className="mt-1 text-sm text-gray-400">Invitez des consultants (Admin, Consultant ou Viewer) et partagez vos diagnostics. Offre Équipe : {PRIX_OFFRE_EQUIPE} €/mois pour {PLACES_OFFRE_EQUIPE} consultants.</p>
            </div>
            <a href="/dashboard/equipe" onClick={(e) => quitter(e, '/dashboard/equipe')}
              className="shrink-0 rounded-lg border border-purple-500 bg-purple-500/10 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20">
              Gérer mon équipe →
            </a>
          </section>

          {/* 📦 Mes données (RGPD) : télécharger ou supprimer */}
          <section id="mes-donnees" className="scroll-mt-20 rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">📦 Mes données</h2>
            <p className="mt-1 text-sm text-gray-400">Vos droits RGPD : récupérer toutes vos données, ou tout effacer.</p>

            {erreurCompte && (
              <p role="alert" className="mt-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {erreurCompte}</p>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg bg-gray-900/60 p-4">
                <p className="font-medium">Télécharger mes données</p>
                <p className="mt-1 text-sm text-gray-400">Un fichier avec vos paramètres, diagnostics, clients et notifications.</p>
                <button type="button" onClick={telechargerMesDonnees} disabled={actionCompte !== null}
                  className="mt-3 rounded-lg border border-blue-500 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50">
                  {actionCompte === 'export' ? 'Préparation…' : '⬇️ Télécharger (.json)'}
                </button>
              </div>

              <div className="rounded-lg border border-red-900 bg-red-950/20 p-4">
                <p className="font-medium text-red-200">Supprimer mon compte</p>
                <p className="mt-1 text-sm text-gray-400">
                  Efface <strong>définitivement</strong> votre compte, vos diagnostics, vos clients et vos paramètres. Les rapports déjà envoyés ne seront plus accessibles.
                </p>
                <label className="mt-3 block text-sm text-gray-300">
                  Pour confirmer, tapez <strong className="text-white">SUPPRIMER</strong>
                  <input className={`${inputClass} mt-1`} value={confirmationSuppression} placeholder="SUPPRIMER"
                    onChange={(e) => setConfirmationSuppression(e.target.value)} autoComplete="off" />
                </label>
                <button type="button" onClick={supprimerCompte}
                  disabled={confirmationSuppression.trim().toUpperCase() !== 'SUPPRIMER' || actionCompte !== null}
                  className="mt-3 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {actionCompte === 'suppression' ? 'Suppression…' : '🗑️ Supprimer mon compte'}
                </button>
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
                 <div>
      <button
        type="button"
        onClick={() => { void enregistrer() }}
        disabled={!nonSauvegarde || !valide || enCours || !enLigne}
        className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        💾 Enregistrer maintenant
      </button>
    </div>
  </div>
 
  </div>
</div>
    </div>
     </div>
    </main>
  )
}
