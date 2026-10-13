   // @ts-nocheck


"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { recalculer } from '../../../lib/calcul-financier';
import RapportDiagnostic from '../../../components/RapportDiagnostic';
import { chargerMonEquipe } from '../../../lib/equipe';
import type { BenchmarkSecteur, DiagnosticIA, MoisSuivi, Niveau, PointFriction, Positionnement, Recommandation } from '../../../lib/moteur-analyse';
import { TEMPLATES, templateSur } from '../../../lib/templates';
import { AVERTISSEMENT_BENCHMARK } from '../../../lib/adapter-template';
const euros = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const NIVEAUX: Niveau[] = ['faible', 'moyenne', 'elevée'];
const CATEGORIES: PointFriction['categorie'][] = ['processus', 'outils', 'communication', 'rh', 'commercial', 'finance', 'achats', 'stock', 'visibilite'];
const QUADRANTS: { valeur: Recommandation['quadrant']; libelle: string }[] = [
  { valeur: 'quick_win', libelle: '⚡ Quick win (effort faible, impact élevé)' },
  { valeur: 'projet_strategique', libelle: ' Projet stratégique (effort élevé, impact élevé)' },
  { valeur: 'optimisation_simple', libelle: '🔧 Optimisation simple (effort faible, impact modéré)' },
  { valeur: 'a_eviter', libelle: ' À éviter (effort élevé, impact faible)' },
];

const SECTEURS = ['Commerce', 'Industrie', 'Services', 'Alimentation', 'Tech', 'Santé', 'BTP'];
const OBJECTIFS = [
  'Augmenter le CA', 'Développer de nouveaux clients', 'Lancer un nouveau produit/service',
  'Améliorer la compétitivité commerciale', 'Améliorer la trésorerie', 'Réduire les coûts',
  'Augmenter les marges', 'Optimiser la facturation', 'Gagner du temps (productivité)',
  'Automatiser les tâches répétitives', 'Améliorer la qualité', 'Réduire les erreurs',
  'Fidéliser les talents', 'Former les équipes', 'Améliorer le management',
  'Équilibrer pro / vie perso', 'Transition numérique', 'Conformité RGPD / réglementaire',
  'Développement durable', 'Préparer la transmission', 'Développer à l\'international',
];

type Diagnostic = {
  id: string;
  user_id: string;
  entreprise: string;
  secteur: string;
  effectif: number | null;
  statut: string;
  updated_at: string;
  diagnostic_json: DiagnosticIA | null;
};

// Valeurs par défaut pour éviter les erreurs
const DIAGNOSTIC_PAR_DEFAUT: DiagnosticIA = {
  points_friction: [],
  recommandations: [],
  plan_4_jours: [],
  opportunites: [],
  feuilleDeRoute: [],
  dimensions: [],
  synthese: {
    actions_prioritaires: ['', '', ''],
    probleme_principal: '',
    accroche: '',
    situation: '',
    texte: '',
  },
  finance: {
    impact_annuel: 0,
    total_heures_economisees_semaine: 0,
    cout_outils_annuel: 0,
    cout_mise_en_place: 0,
    roi_annuel: 0,
    taux_horaire: 40,
  },
  score: 0,
  genereLe: '',
};

export default function RelecturePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [d, setD] = useState<DiagnosticIA>(DIAGNOSTIC_PAR_DEFAUT);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [modifie, setModifie] = useState(false);
  const [etat, setEtat] = useState<'aucun' | 'sauvegarde' | 'erreur'>('aucun');
  const [chargement, setChargement] = useState(true);
  const modifieRef = useRef(false);

  // Charger le diagnostic
  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data, error } = await supabase
        .from('diagnostics')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        alert('Diagnostic introuvable.');
        router.push('/dashboard');
        return;
      }

      setDiagnostic(data);
      const json = data.diagnostic_json || DIAGNOSTIC_PAR_DEFAUT;
      setD({
        ...DIAGNOSTIC_PAR_DEFAUT,
        ...json,
        synthese: { ...DIAGNOSTIC_PAR_DEFAUT.synthese, ...(json.synthese || {}) },
        finance: { ...DIAGNOSTIC_PAR_DEFAUT.finance, ...(json.finance || {}) },
      });
      setChargement(false);
    }
    init();
  }, [id, router]);

  // Sauvegarde auto
  useEffect(() => {
    if (chargement) return;
    const timer = setTimeout(async () => {
      if (!modifie) return;
      const { error } = await supabase
        .from('diagnostics')
        .update({ diagnostic_json: d })
        .eq('id', id);
      if (error) setEtat('erreur');
      else setEtat('sauvegarde');
      setModifie(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [d, id, modifie, chargement]);

  useEffect(() => {
    modifieRef.current = modifie;
  }, [modifie]);

  useEffect(() => {
    function avantFermeture(e: BeforeUnloadEvent) {
      if (modifieRef.current) e.preventDefault();
    }
    window.addEventListener('beforeunload', avantFermeture);
    return () => window.removeEventListener('beforeunload', avantFermeture);
  }, []);

  const changer = useCallback((transformation: (actuel: DiagnosticIA) => DiagnosticIA) => {
    setD((actuel) => (actuel ? recalculer(transformation(actuel)) : actuel));
    setModifie(true);
    setEtat('aucun');
  }, []);

  if (chargement) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p>Chargement du diagnostic...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">️ Relecture du diagnostic</h1>
            <p className="text-gray-400 mt-1">
              {diagnostic?.entreprise} · Modifiez les textes avant envoi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${
              etat === 'sauvegarde' ? 'text-green-400' :
              etat === 'erreur' ? 'text-red-400' : 'text-amber-400'
            }`}>
              {etat === 'sauvegarde' && '✅ Sauvegardé'}
              {etat === 'erreur' && '❌ Erreur de sauvegarde'}
              {etat === 'aucun' && '📝 Modifications en cours'}
            </span>
            <button onClick={() => router.push('/dashboard')}
              className="rounded-lg bg-gray-700 px-4 py-2 font-semibold hover:bg-gray-600">
              ← Retour
            </button>
          </div>
        </div>

        {/* Rapport complet */}
        <RapportDiagnostic d={d} onChange={changer} />
      </div>
    </div>
  );
}