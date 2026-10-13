// API : POST /api/diagnostic
// 1. Vérifie que le consultant est connecté
// 2. Valide les données du formulaire (Zod)
// 3. Enregistre (ou met à jour) le diagnostic dans Supabase
// 4. Demande l'analyse à Claude, avec le prompt du TEMPLATE choisi (Express / Complet / Premium)
// 5. Calcule l'impact financier et enregistre le résultat (+ template et prix conseillé)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getAnthropicClient } from '../../lib/anthropic'
import { diagnosticRequestSchema, type DiagnosticIA, type DiagnosticInput } from '../../lib/diagnostic-schema'
import { NOM_OUTIL_DIAGNOSTIC, configurationTemplate, construireMessageUtilisateur } from '../../lib/prompt-diagnostic'
import { calculerImpact, matriceDepuis } from '../../lib/calcul-financier'
import { adapterAuTemplate, plafonnerHeuresParFriction } from '../../lib/adapter-template'
import { TEMPLATES, type TemplateId } from '../../lib/templates'

export const runtime = 'nodejs'
// Une analyse peut prendre 1 à 3 minutes : on autorise jusqu'à 5 min (utile en production sur Vercel).
export const maxDuration = 300

// Modèle modifiable dans .env.local (ANTHROPIC_MODEL=...) sans toucher au code.
// Remarque : claude-sonnet-4-20250514 a été retiré par Anthropic le 15 juin 2026.
const MODELE = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

const log = (...args: unknown[]) => console.log('[api/diagnostic]', ...args)
const logErreur = (...args: unknown[]) => console.error('[api/diagnostic]', ...args)

function erreur(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status })
}

// ---------------------------------------------------------------------
// Authentification : on vérifie le jeton envoyé par le navigateur, et on crée
// un client Supabase "au nom" du consultant, pour que les règles RLS s'appliquent.
// ---------------------------------------------------------------------
async function requireAuth(request: Request): Promise<
  { ok: true; userId: string; supabase: SupabaseClient } | { ok: false; response: Response }
> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return { ok: false, response: erreur('Connectez-vous pour générer un diagnostic.', 401) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    logErreur('Variables Supabase manquantes dans .env.local')
    return { ok: false, response: erreur('La configuration Supabase est incomplète.', 500) }
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, response: erreur('Votre session a expiré. Reconnectez-vous.', 401) }
  }
  return { ok: true, userId: data.user.id, supabase }
}

// ---------------------------------------------------------------------
// Vérification (souple) de la réponse de Claude.
// z.coerce transforme "12" en 12 si Claude renvoie un nombre sous forme de texte.
// ---------------------------------------------------------------------
const num = z.coerce.number().catch(0)
const niveau = z.enum(['faible', 'moyenne', 'élevée']).catch('moyenne')
const txt = z.coerce.string().catch('')
const textes = z.array(z.coerce.string()).catch([])

const reponseIASchema = z.object({
  synthese: z.object({
    situation: txt,
    probleme_principal: txt,
    actions_prioritaires: textes,
    accroche: txt,
  }),
  points_friction: z.array(z.object({
    id: txt,
    titre: txt,
    description: txt,
    impact_heures_semaine: num,
    urgence: niveau,
    categorie: z.enum(['processus', 'outils', 'communication', 'rh', 'commercial', 'autre']).catch('autre'),
  })).min(1),
  recommandations: z.array(z.object({
    id: txt,
    friction_id: txt,
    nom_outil: txt,
    categorie: txt,
    fonction: txt,
    benefice_concret: txt,
    cout_mensuel_eur: num,
    cout_mise_en_place_eur: num,
    heures_economisees_semaine: num,
    complexite: niveau,
    quadrant: z.enum(['quick_win', 'projet_strategique', 'optimisation_simple', 'a_eviter']).catch('optimisation_simple'),
    conformite_rgpd: z.boolean().catch(false),
    alerte_rgpd: z.string().nullable().catch(null),
    lien_site: txt,
  })).min(1),
  plan_4_jours: z.array(z.object({
    jour: num,
    action: txt,
    outil_requis: txt,
    temps_estime_minutes: num,
    responsable: txt,
    critere_succes: txt,
  })).catch([]),
  opportunites: z.array(z.object({
    titre: txt,
    description: txt,
    potentiel_ca_eur: num,
    delai_mise_en_oeuvre: txt,
    prerequis: textes,
  })).catch([]),
  alertes_rgpd: z.array(z.object({
    nom_outil: txt,
    type_donnees: textes,
    vigilance_requise: txt,
    mesures_recommandees: textes,
  })).catch([]),
  // --- Premium seulement (absents pour Express et Complet) ---
  benchmark_secteur: z.object({
    resume: txt,
    indicateurs: z.array(z.object({
      indicateur: txt,
      entreprise: txt,
      reference_secteur: txt,
      positionnement: z.enum(['en_avance', 'dans_la_moyenne', 'en_retard']).catch('dans_la_moyenne'),
      commentaire: txt,
    })).catch([]),
    bonnes_pratiques: textes,
  }).optional().catch(undefined),
  suivi_3_mois: z.array(z.object({
    mois: num,
    objectif: txt,
    actions: textes,
    indicateurs: z.array(z.object({ nom: txt, cible: txt })).catch([]),
    point_de_suivi: txt,
  })).optional().catch(undefined),
})

// Les calculs financiers sont faits ici, en code, et non par l'IA :
// un modèle de langage peut se tromper en arithmétique, le code non.
// (mêmes formules que l'écran de relecture : app/lib/calcul-financier.ts)
function construireDiagnostic(brut: z.infer<typeof reponseIASchema>, tauxHoraire: number, template: TemplateId): DiagnosticIA {
  const base: DiagnosticIA = {
    ...brut,
    benchmark_secteur: brut.benchmark_secteur ? { ...brut.benchmark_secteur, avertissement: '' } : undefined,
    matrice: matriceDepuis(brut.recommandations),
    impact_financier: calculerImpact(brut.recommandations, tauxHoraire),
  }
  // 1) Pas plus d'heures gagnées que d'heures perdues, point par point
  // 2) On garde seulement les parties du template choisi, puis on recalcule les montants
  return adapterAuTemplate(plafonnerHeuresParFriction(base), template)
}

function resumeTexte(d: DiagnosticIA, entreprise: string, template: TemplateId) {
  const f = d.impact_financier
  return [
    `Diagnostic IA (${TEMPLATES[template].nom}) — ${entreprise}`,
    d.synthese.situation,
    `Problème principal : ${d.synthese.probleme_principal}`,
    `Impact estimé : ${f.impact_annuel.toLocaleString('fr-FR')} €/an (${f.total_heures_economisees_semaine} h/semaine)`,
    'Actions prioritaires :',
    ...d.synthese.actions_prioritaires.map((a) => `- ${a}`),
  ].join('\n')
}

// Colonnes Supabase correspondant aux champs du formulaire
function colonnes(input: DiagnosticInput) {
  return {
    entreprise: input.entreprise,
    secteur: input.secteur,
    ca: input.ca || null,
    effectif: input.effectif,
    ville: input.ville || null, // toute la France : plus de région imposée par défaut
    transcription: input.transcription,
    outils_existants: input.outils_existants,
    objectifs: input.objectifs,
    taux_horaire: input.taux_horaire,
    consentement_rgpd: true,
    consentement_rgpd_at: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  const debut = Date.now()

  // 1. Authentification
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth

  // 2. Validation des données
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erreur('Le corps de la requête doit être un JSON valide.', 400)
  }

  const parsed = diagnosticRequestSchema.safeParse(body)
  if (!parsed.success) {
    const premier = parsed.error.issues[0]
    log('Validation refusée :', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))
    return erreur(premier?.message ?? 'Données invalides.', 400)
  }
  const { id: idExistant, template, ...input } = parsed.data
  const config = configurationTemplate(template) // le bon prompt pour Express / Complet / Premium

  // 3. Enregistrement du brouillon (création ou mise à jour)
  let diagnosticId = idExistant
  if (diagnosticId) {
    const { data, error } = await supabase
      .from('diagnostics').update(colonnes(input)).eq('id', diagnosticId).select('id').maybeSingle()
    if (error || !data) {
      logErreur('Mise à jour du brouillon impossible :', error)
      return erreur('Diagnostic introuvable ou accès refusé.', 404)
    }
  } else {
    const { data, error } = await supabase
      .from('diagnostics').insert({ ...colonnes(input), user_id: userId }).select('id').single()
    if (error || !data) {
      logErreur('Création du diagnostic impossible :', error)
      return erreur('Impossible d’enregistrer le diagnostic. La table "diagnostics" existe-t-elle dans Supabase ?', 500)
    }
    diagnosticId = data.id as string
  }
  // Pas de nom d'entreprise ni de transcription dans les logs (RGPD)
  log(`Analyse lancée — diagnostic ${diagnosticId}, template ${template}, modèle ${MODELE}, transcription ${input.transcription.length} caractères`)

  // 3 bis. Quota d'analyses IA : protège votre budget Anthropic (fichier supabase/10_quota_et_compte.sql)
  // Chaque analyse est comptée AVANT d'appeler l'IA ; si l'IA échoue, elle est « remboursée ».
  let ticketQuota: string | null = null
  const { data: ticket, error: erreurQuota } = await supabase.rpc('consommer_analyse_ia', { p_template: template })
  if (erreurQuota) {
    const message = erreurQuota.message ?? ''
    if (/ESSAI_TERMINE/.test(message)) {
      return erreur('Vos 3 analyses IA offertes sont utilisées. Pour continuer : offre Solo (29 € HT par mois, 30 analyses) dans Paramètres → Mon offre, ou offre Équipe si vous êtes plusieurs. Le 🧪 Mode Démo reste gratuit et illimité.', 402)
    }
    if (/QUOTA_ATTEINT/.test(message)) {
      return erreur('Vous avez utilisé toutes vos analyses IA de ce mois. Elles se renouvellent le 1er du mois prochain. En attendant, le 🧪 Mode Démo reste disponible.', 429)
    }
    if (/TROP_RAPIDE/.test(message)) {
      return erreur('Trop d’analyses lancées en peu de temps (5 maximum en 10 minutes). Patientez quelques minutes.', 429)
    }
    if (/could not find the function|does not exist|schema cache/i.test(message) && process.env.NODE_ENV !== 'production') {
      // Sur votre ordinateur seulement : on laisse passer, avec un avertissement dans le terminal.
      // En ligne, on refuse (plus bas) : sans compteur, n'importe qui pourrait vider votre crédit IA.
      log('⚠️ Quota IA non vérifié : exécutez supabase/10_quota_et_compte.sql puis 13_offres.sql dans Supabase.')
    } else {
      logErreur('Vérification du quota impossible :', message)
      return erreur('Vérification de votre quota impossible pour le moment. Réessayez dans un instant.', 503)
    }
  } else {
    ticketQuota = ticket as string
  }
  // En cas d'échec de l'IA : on rend l'analyse, puis on renvoie le message d'erreur
  const echec = async (message: string, status: number) => {
    if (ticketQuota) await supabase.rpc('rembourser_analyse_ia', { p_id: ticketQuota })
    return erreur(message, status)
  }

  // 4. Appel à Claude
  let diagnostic: DiagnosticIA
  try {
    const reponse = await getAnthropicClient().messages.create({
      model: MODELE,
      max_tokens: config.maxTokens, // Express 4 000 · Complet 12 000 · Premium 16 000 (sinon la réponse serait coupée)
      temperature: config.temperature,
      system: config.system,
      tools: [config.outil],
      tool_choice: { type: 'tool', name: NOM_OUTIL_DIAGNOSTIC },
      messages: [{ role: 'user', content: construireMessageUtilisateur(input, template) }],
    })

    log(`Réponse reçue en ${Math.round((Date.now() - debut) / 1000)} s —`,
      `tokens entrée ${reponse.usage.input_tokens}, sortie ${reponse.usage.output_tokens}, arrêt : ${reponse.stop_reason}`)

    if (reponse.stop_reason === 'max_tokens') {
      return echec('L’analyse a été coupée car elle était trop longue. Réessayez, ou raccourcissez la transcription.', 502)
    }

    const bloc = reponse.content.find((b) => b.type === 'tool_use')
    if (!bloc || bloc.type !== 'tool_use') {
      logErreur('Aucun bloc tool_use dans la réponse', reponse.content)
      return echec('L’IA n’a pas renvoyé de diagnostic exploitable. Réessayez.', 502)
    }

    const verifie = reponseIASchema.safeParse(bloc.input)
    if (!verifie.success) {
      logErreur('Réponse IA au mauvais format :', verifie.error.issues.slice(0, 5))
      return echec('L’IA a renvoyé un diagnostic incomplet. Réessayez.', 502)
    }
    diagnostic = construireDiagnostic(verifie.data, input.taux_horaire, template)
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      logErreur(`Erreur API Anthropic ${e.status} :`, e.message)
      if (e.status === 401) return echec('Clé API Anthropic invalide. Vérifiez ANTHROPIC_API_KEY dans .env.local.', 500)
      if (e.status === 400 && /credit balance/i.test(e.message)) {
        return echec('Crédit Anthropic épuisé : rechargez votre compte sur console.anthropic.com, ou activez le 🧪 Mode Démo dans Paramètres pour tester sans crédit.', 402)
      }
      if (e.status === 404) return echec(`Le modèle "${MODELE}" n’existe pas ou n’est plus disponible.`, 500)
      if (e.status === 429) return echec('Trop de demandes en même temps. Patientez une minute et réessayez.', 429)
      if (e.status === 529 || (e.status ?? 0) >= 500) return echec('Le service d’IA est surchargé. Réessayez dans quelques minutes.', 503)
      return echec('Erreur du service d’IA. Réessayez plus tard.', 502)
    }
    logErreur('Erreur inattendue pendant l’analyse :', e)
    return echec(e instanceof Error ? e.message : 'Erreur inattendue pendant l’analyse.', 500)
  }

  // 5. Enregistrement du résultat (+ le template dans sa colonne, si le script 08 a été exécuté)
  const resultat = {
    diagnostic_json: diagnostic,
    diagnostic_ia_original: diagnostic,
    diagnostic_text: resumeTexte(diagnostic, input.entreprise, template),
    statut: 'analysé',
  }
  let { error: erreurSauvegarde } = await supabase.from('diagnostics').update({ ...resultat, template }).eq('id', diagnosticId)
  if (erreurSauvegarde && /template/i.test(erreurSauvegarde.message ?? '')) {
    log('Colonne "template" absente : exécutez supabase/08_templates.sql. Enregistrement sans elle.')
    ;({ error: erreurSauvegarde } = await supabase.from('diagnostics').update(resultat).eq('id', diagnosticId))
  }

  // Prix conseillé du template, seulement si le consultant n'a pas encore saisi de prix
  const { error: erreurPrix } = await supabase
    .from('diagnostics')
    .update({ prix_diagnostic: TEMPLATES[template].prix })
    .eq('id', diagnosticId)
    .is('prix_diagnostic', null)
  if (erreurPrix) log('Prix conseillé non enregistré :', erreurPrix.message)

  if (erreurSauvegarde) {
    // On renvoie quand même le résultat pour ne pas perdre l'analyse (déjà payée)
    logErreur('Analyse obtenue mais non enregistrée :', erreurSauvegarde)
  }

  log(`Terminé en ${Math.round((Date.now() - debut) / 1000)} s`)
  return Response.json({
    success: true,
    data: { id: diagnosticId, diagnostic, enregistre: !erreurSauvegarde },
  })
}
