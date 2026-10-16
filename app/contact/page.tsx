import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        
        <h1 className="text-3xl md:text-4xl font-bold">
          Contactez Vizion Scan
        </h1>
        
        <p className="text-gray-400 text-lg">
          Une question ? Un devis rapide ?<br/>
          Réponse garantie sous 24h ouvrées.
        </p>

        {/* Option 1 : Le Bouton Magique */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 my-8 shadow-xl">
          
          <a 
            href="mailto:contact@vizionscan.com?subject=Demande%20Vizion%20Scan"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-all transform hover:-translate-y-1 active:scale-[0.98] mb-6"
          >
            ✉️ Ouvrir mon email maintenant
          </a>

          <div className="border-t border-gray-700 pt-6 mt-6">
            <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Ou copiez notre adresse :</p>
            
            {/* Option 2 : L'Email Visible et Copiable */}
            <span className="block text-2xl md:text-3xl font-mono text-blue-400 break-all select-all cursor-pointer hover:text-blue-300 transition-colors">
              contact@vizionscan.com
            </span>
            
            <p className="mt-4 text-xs text-gray-500 italic">
              Cliquez sur l'adresse ci-dessus pour la sélectionner, puis faites Ctrl+C (ou Clic Droit &gt; Copier).
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Link href="/" className="text-gray-500 hover:text-white underline text-sm">
            ← Retour à l'accueil
          </Link>
        </div>

      </div>
    </main>
  );
}