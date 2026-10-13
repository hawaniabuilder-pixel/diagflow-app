interface Props {
  valeur: 'express' | 'complet' | 'premium';
  onChange: (t: 'express' | 'complet' | 'premium') => void | Promise<void>;
  nom: string;
  desactive: boolean;
}

const OPTIONS: { cle: 'express' | 'complet' | 'premium'; label: string; desc: string }[] = [
  { cle: 'express', label: 'Express', desc: '2 pages · synthèse + chiffres clés' },
  { cle: 'complet', label: 'Complet', desc: '6 pages · le diagnostic intégral' },
  { cle: 'premium', label: 'Premium', desc: 'Complet + suivi à 1, 2 et 3 mois' },
];

export default function TemplateSelector({ valeur, onChange, nom, desactive }: Props) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(o => (
          <button
            key={o.cle}
            type="button"
            disabled={desactive}
            onClick={() => { void onChange(o.cle); }}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              valeur === o.cle
                ? 'border-emerald-500 bg-emerald-900/20'
                : 'border-gray-700 bg-black/30 hover:border-gray-500'
            } ${desactive ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span className="block font-bold text-gray-100">{o.label}</span>
            <span className="mt-1 block text-xs text-gray-400">{o.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">Format de rapport pour {nom} : {valeur}</p>
    </div>
  );
}