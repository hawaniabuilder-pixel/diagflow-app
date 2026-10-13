"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { analyserTranscription } from '../lib/moteur-analyse';

/* ---------- Listes du formulaire ---------- */
const SECTEURS = ["Commerce", "Industrie", "Services", "Alimentation", "Tech", "Santé", "BTP"];

const OBJECTIFS = [
  "Croissance du CA", "Développer de nouveaux clients", "Lancer un nouveau produit/service",
  "Développer l'activité commerciale", "Améliorer la trésorerie", "Réduire les coûts",
  "Augmenter les marges", "Optimiser la facturation", "Gagner du temps (productivité)",
  "Automatiser les tâches répétitives", "Améliorer la qualité", "Réduire les erreurs",
  "Recruter / fidéliser les talents", "Former les équipes", "Améliorer le management",
  "Équilibre vie pro / vie perso", "Transition numérique", "Conformité RGPD / réglementaire",
  "RSE / développement durable", "Préparer la transmission", "Développer à l'international",
];

const OUTILS_CATEGORIES = [
  { categorie: "Comptabilité & facturation", outils: ["Excel", "EBP", "Sage", "QuickBooks", "Pennylane", "Henrri", "Indy", "Axonaut"] },
  { categorie: "CRM & commercial", outils: ["HubSpot", "Pipedrive", "Sellsy", "NoCRM", "Zoho CRM", "Aucun (suivi papier)"] },
  { categorie: "Communication", outils: ["WhatsApp", "Gmail / Outlook", "Microsoft Teams", "Slack", "Messenger", "SMS"] },
  { categorie: "Collaboration & projets", outils: ["Google Workspace", "Microsoft 365", "Trello", "Notion", "Asana", "Monday"] },
  { categorie: "RH & paie", outils: ["PayFit", "Silae", "Skello", "Lucca", "Tableur Excel", "Papier"] },
  { categorie: "Encaissement & métier", outils: ["SumUp", "Square", "Tiller", "Lightspeed", "Batappli", "illiPro", "Doctolib", "Planity"] },
  { categorie: "Marketing & visibilité", outils: ["Canva", "Brevo", "Mailchimp", "Instagram / Meta", "Google Business Profile", "Aucun"] },
];

/* ---------- Toute la France : régions + départements ---------- */
const REGIONS_FRANCE = [
  "Île-de-France", "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France", "Normandie",
  "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  "Guadeloupe", "Martinique", "Guyane", "La Réunion", "Mayotte",
];

const DEPARTEMENTS_PAR_REGION: Record<string, { code: string; nom: string }[]> = {
  "Île-de-France": [{ code: "75", nom: "Paris" }, { code: "77", nom: "Seine-et-Marne" }, { code: "78", nom: "Yvelines" }, { code: "91", nom: "Essonne" }, { code: "92", nom: "Hauts-de-Seine" }, { code: "93", nom: "Seine-Saint-Denis" }, { code: "94", nom: "Val-de-Marne" }, { code: "95", nom: "Val-d'Oise" }],
  "Auvergne-Rhône-Alpes": [{ code: "01", nom: "Ain" }, { code: "03", nom: "Allier" }, { code: "07", nom: "Ardèche" }, { code: "15", nom: "Cantal" }, { code: "26", nom: "Drôme" }, { code: "38", nom: "Isère" }, { code: "42", nom: "Loire" }, { code: "43", nom: "Haute-Loire" }, { code: "63", nom: "Puy-de-Dôme" }, { code: "69", nom: "Rhône" }, { code: "73", nom: "Savoie" }, { code: "74", nom: "Haute-Savoie" }],
  "Bourgogne-Franche-Comté": [{ code: "21", nom: "Côte-d'Or" }, { code: "25", nom: "Doubs" }, { code: "39", nom: "Jura" }, { code: "58", nom: "Nièvre" }, { code: "70", nom: "Haute-Saône" }, { code: "71", nom: "Saône-et-Loire" }, { code: "89", nom: "Yonne" }, { code: "90", nom: "Territoire de Belfort" }],
  "Bretagne": [{ code: "22", nom: "Côtes-d'Armor" }, { code: "29", nom: "Finistère" }, { code: "35", nom: "Ille-et-Vilaine" }, { code: "56", nom: "Morbihan" }],
  "Centre-Val de Loire": [{ code: "18", nom: "Cher" }, { code: "28", nom: "Eure-et-Loir" }, { code: "36", nom: "Indre" }, { code: "37", nom: "Indre-et-Loire" }, { code: "41", nom: "Loir-et-Cher" }, { code: "45", nom: "Loiret" }],
  "Corse": [{ code: "2A", nom: "Corse-du-Sud" }, { code: "2B", nom: "Haute-Corse" }],
  "Grand Est": [{ code: "08", nom: "Ardennes" }, { code: "10", nom: "Aube" }, { code: "51", nom: "Marne" }, { code: "52", nom: "Haute-Marne" }, { code: "54", nom: "Meurthe-et-Moselle" }, { code: "55", nom: "Meuse" }, { code: "57", nom: "Moselle" }, { code: "67", nom: "Bas-Rhin" }, { code: "68", nom: "Haut-Rhin" }, { code: "88", nom: "Vosges" }],
  "Hauts-de-France": [{ code: "02", nom: "Aisne" }, { code: "59", nom: "Nord" }, { code: "60", nom: "Oise" }, { code: "62", nom: "Pas-de-Calais" }, { code: "80", nom: "Somme" }],
  "Normandie": [{ code: "14", nom: "Calvados" }, { code: "27", nom: "Eure" }, { code: "50", nom: "Manche" }, { code: "61", nom: "Orne" }, { code: "76", nom: "Seine-Maritime" }],
  "Nouvelle-Aquitaine": [{ code: "16", nom: "Charente" }, { code: "17", nom: "Charente-Maritime" }, { code: "19", nom: "Corrèze" }, { code: "23", nom: "Creuse" }, { code: "24", nom: "Dordogne" }, { code: "33", nom: "Gironde" }, { code: "40", nom: "Landes" }, { code: "47", nom: "Lot-et-Garonne" }, { code: "64", nom: "Pyrénées-Atlantiques" }, { code: "79", nom: "Deux-Sèvres" }, { code: "86", nom: "Vienne" }, { code: "87", nom: "Haute-Vienne" }],
  "Occitanie": [{ code: "09", nom: "Ariège" }, { code: "11", nom: "Aude" }, { code: "12", nom: "Aveyron" }, { code: "30", nom: "Gard" }, { code: "31", nom: "Haute-Garonne" }, { code: "32", nom: "Gers" }, { code: "34", nom: "Hérault" }, { code: "46", nom: "Lot" }, { code: "48", nom: "Lozère" }, { code: "65", nom: "Hautes-Pyrénées" }, { code: "66", nom: "Pyrénées-Orientales" }, { code: "81", nom: "Tarn" }, { code: "82", nom: "Tarn-et-Garonne" }],
  "Pays de la Loire": [{ code: "44", nom: "Loire-Atlantique" }, { code: "49", nom: "Maine-et-Loire" }, { code: "53", nom: "Mayenne" }, { code: "72", nom: "Sarthe" }, { code: "85", nom: "Vendée" }],
  "Provence-Alpes-Côte d'Azur": [{ code: "04", nom: "Alpes-de-Haute-Provence" }, { code: "05", nom: "Hautes-Alpes" }, { code: "06", nom: "Alpes-Maritimes" }, { code: "13", nom: "Bouches-du-Rhône" }, { code: "83", nom: "Var" }, { code: "84", nom: "Vaucluse" }],
  "Guadeloupe": [{ code: "971", nom: "Guadeloupe" }],
  "Martinique": [{ code: "972", nom: "Martinique" }],
  "Guyane": [{ code: "973", nom: "Guyane" }],
  "La Réunion": [{ code: "974", nom: "La Réunion" }],
  "Mayotte": [{ code: "976", nom: "Mayotte" }],
};

const DONNEES_DEMO = {
  entreprise: "EcoRénov Solutions",
  secteur: "BTP",
  ca: "2 500 000 €",
  effectif: "15",
  region: "Île-de-France",
  ville: "Montreuil",
  departement: "93",
  transcription: "Consultant : Bonjour Marc, comment créez-vous vos devis ?\nMarc : On met 3 à 4 jours, tout est recopié sur Excel ou Word, avec des erreurs de prix.\nConsultant : Et sur les chantiers ?\nMarc : C'est un groupe WhatsApp, l'information se perd. Une équipe est arrivée sans les bonnes fenêtres.\nConsultant : Et la facturation ?\nMarc : On facture en retard. J'ai 45 000 euros de factures non payées à plus de 60 jours, ma trésorerie souffre.\nConsultant : Vos objectifs ?\nMarc : Réduire le temps de devis, récupérer la trésorerie, et suivre l'avancement des chantiers sans appels incessants.",
  tauxHoraire: "45",
  objectifs: ["Productivité", "Réduction coûts"],
  outils: ["WhatsApp", "Excel"],
  outilsAutre: "",
  rgpd: true,
};

/* ---------- Le rapport style consultant ---------- */
function RapportLocal({ d, onNouveau }: { d: any; onNouveau: () => void }) {
  const couleurScore = d.scoreMaturite >= 70
    ? 'text-emerald-300 border-emerald-600 bg-emerald-900/30'
    : d.scoreMaturite >= 45
      ? 'text-amber-300 border-amber-600 bg-amber-900/30'
      : 'text-red-300 border-red-600 bg-red-900/30';

  const quadrants = [
    { cle: 'quick-win', titre: '⭐ Quick Wins', sous: 'Effort faible · Impact fort', classe: 'border-emerald-700 bg-emerald-900/20' },
    { cle: 'stratégique', titre: '🎯 Projets stratégiques', sous: 'Effort fort · Impact fort', classe: 'border-blue-700 bg-blue-900/20' },
    { cle: 'optimisation', titre: '🔧 Optimisations', sous: 'Effort faible · Impact faible', classe: 'border-gray-600 bg-gray-800/40' },
    { cle: 'à éviter', titre: '⛔ À éviter', sous: 'Effort fort · Impact faible', classe: 'border-red-800 bg-red-900/10' },
  ];

  const copierSynthese = async () => {
    const texte = `Diagnostic ${d.entreprise} — maturité digitale ${d.scoreMaturite}/100.\n${d.synthese}\nGain potentiel : ${d.financier.gainAnnuel.toLocaleString('fr-FR')} €/an.`;
    try {
      await navigator.clipboard.writeText(texte);
      alert('✅ Synthèse copiée ! Collez-la dans votre email client.');
    } catch {
            const ta = document.createElement('textarea');
      ta.value = texte;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('✅ Synthèse copiée ! Collez-la dans votre email client.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-700 bg-gradient-to-r from-blue-950 to-purple-950 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-300">Rapport de diagnostic · DiagFlow</p>
            <h2 className="mt-1 text-3xl font-bold text-white">{d.entreprise}</h2>
            <p className="mt-1 text-sm text-blue-200">
              {d.secteur} · 📍 {d.ville} · {d.effectif} salariés · CA {d.ca || 'n.c.'}
            </p>
            {'modeIntervention' in d && d.modeIntervention && (
  <span className="mt-2 inline-block rounded-full border border-blue-600 bg-blue-900/40 px-3 py-1 text-xs text-blue-200">
    {d.modeIntervention}
  </span>
)} 

          </div>
          <div className={`rounded-xl border px-5 py-3 text-center ${couleurScore}`}>
            <p className="text-3xl font-black">{d.scoreMaturite}<span className="text-base font-semibold">/100</span></p>
            <p className="text-xs uppercase tracking-wider">Maturité digitale</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-black/30 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-300">{(d.financier?.gainAnnuel ?? d.gainAnnuel ?? 0).toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-blue-200">Gain potentiel / an</p>
          </div>
          <div className="rounded-lg bg-black/30 p-4 text-center">
            <p className="text-2xl font-bold text-white">{d.financier.heuresSemaine} h</p>
            <p className="text-xs text-blue-200">Récupérables / semaine</p>
          </div>
          <div className="rounded-lg bg-black/30 p-4 text-center">
            <p className="text-2xl font-bold text-blue-300">{d.financier.paybackMois} mois</p>
            <p className="text-xs text-blue-200">Délai de remboursement</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">📈 Maturité par dimension</h3>
        <div className="space-y-3">
          {(Array.isArray(d.dimensions) ? d.dimensions : Object.values(d.dimensions || {})).map((dim: any) => (
  <div key={dim.nom}>
    <div className="mb-1 flex justify-between text-sm">
      <span className="text-gray-200">{dim.nom}</span>
      <span className="text-gray-400">{dim.score}/100 · {dim.etat}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
      <div className={`h-full rounded-full ${dim.score >= 75 ? 'bg-emerald-500' : dim.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${dim.score}%` }}></div>
    </div>
  </div>
))}
          
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-3 text-lg font-bold text-white">📊 Synthèse exécutive</h3>
        <p className="leading-relaxed text-gray-300">{d.synthese}</p>
        <p className="mt-3 rounded-lg border border-gray-700 bg-gray-800/60 p-3 text-sm text-gray-400">📊 {d.benchmark}</p>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">🧭 Matrice effort / impact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quadrants.map((q) => (
            <div key={q.cle} className={`rounded-lg border p-4 ${q.classe}`}>
              <p className="font-semibold text-white">{q.titre}</p>
              <p className="mb-3 text-xs text-gray-400">{q.sous}</p>
              <ul className="space-y-1 text-sm text-gray-200">
                {d.recommandations.filter((r: any) => r.quadrant === q.cle).map((r: any) => (
                  <li key={r.nom}>• {r.nom}</li>
                ))}
                {d.recommandations.filter((r: any) => r.quadrant === q.cle).length === 0 && (
                  <li className="text-gray-500">—</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">⚠️ Points de friction identifiés</h3>
        <div className="space-y-3">
          {d.frictions.map((f: any, i: number) => (
            <div key={i} className="rounded-lg border border-red-900/50 bg-red-900/10 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-white">{f.titre}</h4>
                <span className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 text-xs text-gray-300">~{f.heuresSemaine} h/sem</span>
              </div>
              <p className="text-sm text-gray-300">{f.description}</p>
              {f.indices.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">🔎 Détecté dans l'entretien : {f.indices.map((m: string) => `« ${m} »`).join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">🛠️ Recommandations d'outils</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {d.recommandations.map((r: any, i: number) => (
            <div key={i} className="rounded-lg border border-green-900/50 bg-green-900/10 p-4">
              <h4 className="mb-1 font-semibold text-green-300">{r.nom}</h4>
              <p className="mb-2 text-sm text-gray-300">{r.benefice}</p>
              <div className="mb-2 flex justify-between text-xs text-gray-400">
                <span>{r.coutMensuel} €/mois</span>
                <span className="text-green-400">+{r.heuresGagnees} h/sem</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${r.confiance}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-500">Indice de confiance : {r.confiance} %</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-700 bg-gradient-to-br from-emerald-950/40 to-blue-950/40 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">💰 Impact financier chiffré</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-black/30 p-3 text-center">
            <p className="text-xl font-bold text-emerald-300">{d.financier.gainMensuel.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-gray-400">/ mois</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3 text-center">
            <p className="text-xl font-bold text-emerald-300">{d.financier.gainAnnuel.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-gray-400">/ an</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3 text-center">
            <p className="text-xl font-bold text-amber-300">{d.financier.coutOutilsMensuel} €</p>
            <p className="text-xs text-gray-400">outils / mois</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3 text-center">
            <p className="text-xl font-bold text-blue-300">{d.financier.roiAnnuelNet.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-gray-400">ROI net / an</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">🗓️ Feuille de route 90 jours</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {d.feuilleDeRoute.map((etape: any, i: number) => (
            <div key={i} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="mb-2 font-semibold text-blue-300">{etape.periode}</p>
              <ul className="space-y-1 text-sm text-gray-300">
                {etape.actions.map((a: string, j: number) => <li key={j}>→ {a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => alert('🔬 Analyse IA approfondie : disponible dès que vos crédits Anthropic sont actifs.\n\nLe diagnostic actuel (moteur local) est déjà complet et utilisable.')}
          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
        >
          🔬 Approfondir avec l'IA (Premium)
        </button>
        <button onClick={() => { alert('📄 Dans la fenêtre qui va s\'ouvrir :\n1. Destination : choisissez « Enregistrer au format PDF »\n2. Cliquez sur « Enregistrer »\n3. Choisissez où garder le fichier (Bureau par exemple).'); window.print(); }} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
          🖨️ Exporter en PDF (impression)
        </button>
        <button onClick={copierSynthese} className="rounded-lg bg-gray-700 px-6 py-3 font-semibold text-white transition hover:bg-gray-600">
          📋 Copier la synthèse
        </button>
        <button onClick={onNouveau} className="rounded-lg bg-gray-800 px-6 py-3 font-semibold text-gray-300 transition hover:bg-gray-700">
          🔄 Nouveau diagnostic
        </button>
      </div>
    </div>
  );
}

/* ---------- Page principale ---------- */
export default function DiagnosticPage() {
  const [form, setForm] = useState({
    entreprise: "", secteur: "", ca: "", effectif: "",
    region: "Île-de-France", ville: "", departement: "75",
    transcription: "", tauxHoraire: "40", objectifs: [] as string[],
    outils: [] as string[], outilsAutre: "", rgpd: false,
  });
  const [etatSauvegarde, setEtatSauvegarde] = useState<'ok' | 'modifie' | 'enCours'>('ok');
  const [enLigne, setEnLigne] = useState(true);
  const [modeDemo, setModeDemo] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const idRef = useRef<string | null>(null);

  const [attenteEmail, setAttenteEmail] = useState("");
  const [attenteRegion, setAttenteRegion] = useState("");
  const [attenteOk, setAttenteOk] = useState(false);
  const [attenteErreur, setAttenteErreur] = useState("");

  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  async function rejoindreListeAttente() {
    const email = attenteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAttenteErreur("Entrez un email valide (ex: nom@entreprise.fr).");
      return;
    }
    setAttenteErreur("");
    const { error } = await supabase.from('liste_attente').insert({
      email,
      region_souhaitee: attenteRegion.trim() || 'Non précisé',
    });
    if (error) {
      if (error.code === '23505') setAttenteErreur("Cet email est déjà inscrit. Merci !");
      else setAttenteErreur("Inscription impossible pour le moment. Réessayez.");
      return;
    }
    setAttenteOk(true);
    setAttenteEmail("");
    setAttenteRegion("");
  }

  async function sauvegarderSupabase() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const id = idRef.current ?? crypto.randomUUID();
      idRef.current = id;
      const { error } = await supabase.from('diagnostics').upsert({
        id,
        user_id: session.user.id,
        entreprise: form.entreprise,
        secteur: form.secteur,
        ca: form.ca,
        effectif: form.effectif === '' ? null : Number(form.effectif),
        ville: form.ville + ' (' + form.departement + ') · ' + form.region,
        transcription: form.transcription,
        outils_existants: [...form.outils, ...form.outilsAutre.split(',').map((s) => s.trim()).filter(Boolean)],
        objectifs: form.objectifs,
        taux_horaire: Number(form.tauxHoraire) || 40,
        statut: 'brouillon',
      });
      if (error) console.warn('[DiagFlow] Sauvegarde Supabase :', error.message);
    } catch (e) {
      console.warn('[DiagFlow] Supabase indisponible :', e);
    }
  }

  async function sauvegarderResultat(res: any) {
    if (!idRef.current) return;
    try {
      await supabase.from('diagnostics').update({
        diagnostic_json: res,
        statut: 'analysé',
      }).eq('id', idRef.current);
    } catch (e) {
      console.warn('[DiagFlow] Enregistrement du résultat :', e);
    }
  }

  useEffect(() => {
    if (form.entreprise && form.rgpd) {
      setEtatSauvegarde('modifie');
      const timer = setTimeout(async () => {
        setEtatSauvegarde('enCours');
        localStorage.setItem('diagflow_brouillon', JSON.stringify(form));
        await sauvegarderSupabase();
        setEtatSauvegarde('ok');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [form]);

  const remplirDemo = () => { setForm(DONNEES_DEMO); setErreurs({}); };

  const valider = () => {
    const e: Record<string, string> = {};
    if (!form.entreprise) e.entreprise = "Obligatoire";
    if (!form.secteur) e.secteur = "Obligatoire";
    if (form.transcription.length < 50) e.transcription = "Minimum 50 caractères";
    if (!form.rgpd) e.rgpd = "Vous devez accepter le RGPD";
    setErreurs(e);
    return Object.keys(e).length === 0;
  };

  const toggleObjectif = (obj: string) => setForm(p => ({ ...p, objectifs: p.objectifs.includes(obj) ? p.objectifs.filter(o => o !== obj) : [...p.objectifs, obj] }));
  const toggleOutil = (outil: string) => setForm(p => ({ ...p, outils: p.outils.includes(outil) ? p.outils.filter(o => o !== outil) : [...p.outils, outil] }));

  const genererAnalyse = async () => {
    if (!valider()) return;
    if (!enLigne) { alert("Internet est coupé."); return; }
    setGeneration(true);
    for (let i = 0; i <= 100; i += 20) await new Promise(r => setTimeout(r, 200));
       await sauvegarderSupabase();    
    const res = await analyserTranscription({
      transcription: form.transcription,
      entreprise: form.entreprise,
      secteur: form.secteur,
      ville: form.ville + ' (' + form.departement + ') · ' + form.region,
      region: form.region,
      effectif: Number(form.effectif) || 0,
      ca: Number(form.ca) || 0,
      tauxHoraire: Number(form.tauxHoraire) || 40,
    });
    setResultat(res);
    setGeneration(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Nouveau Diagnostic</h1>
            <p className="text-gray-400 mt-1">Remplissez l'entretien pour générer un rapport de consultant.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${enLigne ? 'bg-green-900/50 border-green-700 text-green-300' : 'bg-red-900/50 border-red-700 text-red-300'}`}>
              {enLigne ? '🟢 Connecté' : '🔴 Hors ligne'}
            </span>
            <button onClick={() => setModeDemo(!modeDemo)} className={`px-3 py-1 rounded-full text-xs font-bold border ${modeDemo ? 'bg-purple-900/50 border-purple-700 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
               {modeDemo ? '🧪 Mode Démo : ON' : 'Mode Démo : OFF'}
            </button>
          </div>
        </header>

        {/* AMÉLIORATION 1 : bandeau France entière avec compteur */}
        <div className="mb-6 rounded-lg border border-blue-800 bg-blue-950/40 p-4 text-sm text-blue-200 print:hidden">
          🇫🇷 <strong>Intervention toute la France :</strong> 101 départements couverts.
          Île-de-France = sur site sous 48 h · Autres régions = 100 % à distance (visio), même exigence de qualité.
        </div>

        {/* Liste d'attente hors IDF (sur site) */}
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-900 p-4print:hidden">
          {attenteOk ? (
            <p className="text-sm text-emerald-300">
              ✅ Merci ! Vous serez averti dès l'ouverture de votre zone. Surveillez votre boîte mail.
            </p>
          ) : (
            <div>
              <p className="mb-2 text-sm text-gray-300">
                📍 <strong>Accompagnement SUR SITE hors Île-de-France ?</strong> Rejoignez la liste d'attente : nous ouvrons une zone dès 10 entreprises inscrites. En attendant, le diagnostic à distance est disponible partout.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={attenteEmail} onChange={e => setAttenteEmail(e.target.value)} type="email" placeholder="votre@email.fr"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={attenteRegion} onChange={e => setAttenteRegion(e.target.value)} placeholder="Votre région (ex: Auvergne-Rhône-Alpes)"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={rejoindreListeAttente}
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700">
                  M'avertir
                </button>
              </div>
              {attenteErreur && <p className="mt-2 text-xs text-red-400">{attenteErreur}</p>}
            </div>
          )}
        </div>

        {!enLigne && (
          <div className="mb-6 bg-amber-900/30 border border-amber-700 text-amber-200 p-4 rounded-lg">
            ⚠️ <strong>Internet coupé.</strong> Vos modifications sont gardées et partiront au retour de la connexion.
          </div>
        )}

        {!resultat && !generation && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">🏢 L'entreprise</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nom *</label>
                    <input value={form.entreprise} onChange={e => setForm({ ...form, entreprise: e.target.value })}
                      className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 ${erreurs.entreprise ? 'border-red-500' : 'border-gray-700'}`} placeholder="Ex: EcoRénov Solutions" />
                    {erreurs.entreprise && <p className="text-xs text-red-400 mt-1">{erreurs.entreprise}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Secteur *</label>
                    <select value={form.secteur} onChange={e => setForm({ ...form, secteur: e.target.value })}
                      className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 ${erreurs.secteur ? 'border-red-500' : 'border-gray-700'}`}>
                      <option value="">Choisir...</option>
                      {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Chiffre d'affaires</label>
                    <input value={form.ca} onChange={e => setForm({ ...form, ca: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="500 000 €" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Salariés</label>
                    <input type="number" value={form.effectif} onChange={e => setForm({ ...form, effectif: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="10" />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Région *</label>
                      <select value={form.region} onChange={e => {
                        const r = e.target.value;
                        const deps = DEPARTEMENTS_PAR_REGION[r] || [];
                        setForm({ ...form, region: r, departement: deps[0]?.code || "" });
                      }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {REGIONS_FRANCE.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Département *</label>
                      <select value={form.departement} onChange={e => setForm({ ...form, departement: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {(DEPARTEMENTS_PAR_REGION[form.region] || []).map(d => <option key={d.code} value={d.code}>{d.code} — {d.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Ville *</label>
                      <input value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Montreuil, Lyon, Nantes..." />
                    </div>
                  </div>
                  {/* AMÉLIORATION 2 : message dynamique selon la région */}
                  <p className="md:col-span-2 text-xs text-gray-400">
                    {form.region === 'Île-de-France'
                      ? '🚗 Île-de-France : intervention sur site sous 48 h incluse dans le diagnostic.'
                      : '💻 ' + form.region + ' : diagnostic 100 % à distance (visio + plateforme), même exigence de qualité.'}
                  </p>
                </div>
                <button onClick={remplirDemo} className="mt-4 text-xs text-purple-400 hover:text-purple-300 underline">🧪 Remplir avec des données de test</button>
              </section>

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">🎯 Objectifs prioritaires</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {OBJECTIFS.map(obj => (
                    <button key={obj} type="button" onClick={() => toggleObjectif(obj)}
                      className={`p-3 rounded-lg border text-sm font-medium transition ${form.objectifs.includes(obj) ? 'bg-blue-900/40 border-blue-600 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {form.objectifs.includes(obj) && '✓ '}{obj}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">🛠️ Outils déjà utilisés</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {OUTILS_CATEGORIES.map(g => (
                    <div key={g.categorie} className="bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">{g.categorie}</h3>
                      <div className="space-y-2">
                        {g.outils.map(outil => (
                          <label key={outil} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={form.outils.includes(outil)} onChange={() => toggleOutil(outil)} className="w-4 h-4 accent-blue-500" />
                            {outil}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Autres outils (séparés par des virgules)</label>
                  <input value={form.outilsAutre} onChange={e => setForm({ ...form, outilsAutre: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Batappli, Doctolib..." />
                </div>
              </section>

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">📝 Transcription de l'entretien</h2>
                  <span className="text-xs text-gray-500">{form.transcription.length} caractères</span>
                </div>
                <textarea value={form.transcription} onChange={e => setForm({ ...form, transcription: e.target.value })}
                  rows={10}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none ${erreurs.transcription ? 'border-red-500' : 'border-gray-700'}`}
                  placeholder="Collez la transcription ici..." />
                {erreurs.transcription && <p className="text-xs text-red-400 mt-1">{erreurs.transcription}</p>}
              </section>

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">💰 Taux horaire (€/h)</h2>
                <input type="number" value={form.tauxHoraire} onChange={e => setForm({ ...form, tauxHoraire: e.target.value })}
                  className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </section>

              <section className={`rounded-xl border p-6 ${erreurs.rgpd ? 'border-red-700 bg-red-900/20' : 'border-blue-900 bg-blue-900/20'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.rgpd} onChange={e => setForm({ ...form, rgpd: e.target.checked })} className="mt-1 w-5 h-5 accent-blue-500 rounded" />
                  <span className="text-sm text-gray-300">J'accepte le traitement des données de cet entretien pour réaliser le diagnostic. <span className="text-blue-400">*</span></span>
                </label>
                {erreurs.rgpd && <p className="text-xs text-red-400 mt-2 ml-8">{erreurs.rgpd}</p>}
              </section>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Aperçu en direct</h3>
                  <div className="bg-white text-gray-900 rounded-lg p-5 shadow-2xl space-y-3">
                    <div className="border-b border-gray-200 pb-3">
                      <p className="font-bold text-lg">{form.entreprise || "Nom de l'entreprise"}</p>
                      <p className="text-xs text-gray-500">{form.secteur || "Secteur"} · {form.ville || "Ville"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Objectifs</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {form.objectifs.length > 0 ? form.objectifs.map(o => <span key={o} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{o}</span>) : <span className="text-xs text-gray-400">Aucun</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Outils actuels</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {form.outils.length > 0 ? form.outils.map(o => <span key={o} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{o}</span>) : <span className="text-xs text-gray-400">Aucun</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {etatSauvegarde === 'enCours' && <span className="text-blue-400 animate-pulse">💾 Enregistrement...</span>}
                  {etatSauvegarde === 'ok' && <span className="text-green-400">✅ Sauvegardé</span>}
                  {etatSauvegarde === 'modifie' && <span className="text-amber-400">✏️ Modifications en cours...</span>}
                </div>

                <button onClick={genererAnalyse} disabled={generation || !enLigne}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-4 rounded-lg transition-all shadow-lg">
                  {generation ? (
                    <><span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> Analyse en cours...</>
                  ) : (
                    <>{modeDemo ? "🧪 Générer l'analyse (Démo)" : "Générer l'analyse IA"}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {generation && (
          <div className="mt-8 rounded-xl border border-blue-900 bg-gray-800 p-6">
            <div className="flex items-center gap-3">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></span>
              <p className="font-medium text-white">Le moteur local analyse l'entretien...</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-700">
              <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {resultat && !generation && (
          <RapportLocal d={resultat} onNouveau={() => setResultat(null)} />
        )}

      </div>
    </main>
  );
}