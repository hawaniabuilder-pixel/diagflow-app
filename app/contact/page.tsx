import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        
        {/* Titre */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Contactez Vizion Scan
        </h1>
        
        {/* Description */}
        <p className="text-gray-400 text-lg leading-relaxed">
          Une question sur les tarifs ? Besoin d'un devis rapide ?<br/>
          Écrivez-nous directement. Réponse garantie sous 24h ouvrées.
        </p>

        {/* BLOC EMAIL SIMPLE ET EFFICACE (Pas de bouton magique qui bugue) */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 my-8 shadow-xl relative group hover:border-blue-500 transition-colors duration-300">
          
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-3 font-semibold">Notre adresse email :</p>
          
          {/* L'EMAIL EN GROS - Texte simple, pas de lien href mailto */}
          <div className="relative inline-block">
            <span 
              className="block text-2xl md:text-3xl font-mono text-blue-400 break-all select-all cursor-pointer hover:text-blue-300 transition-colors z-10 relative"
              title="Cliquez pour copier automatiquement"
              onClick={() => navigator.clipboard.writeText('contact@vizionscan.com')}
            >
              contact@vizionscan.com
            </span>
            
            {/* Petit message de confirmation invisible par défaut */}
            <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              ✓ Email copié ! Collez-le dans votre messagerie.
            </span>
          </div>
          
          <p className="mt-6 text-xs text-gray-500 italic">
            👆 Cliquez sur l'adresse ci-dessus pour la copier.<br/>
            Ouvrez ensuite Gmail/Outlook et collez-la (Ctrl+V) dans le champ destinataire.
          </p>
        </div>

        {/* Lien retour accueil discret */}
        <div className="pt-4">
          <Link href="/" className="text-gray-500 hover:text-white underline decoration-dotted underline-offset-4 text-sm transition-colors">
            ← Retour à l'accueil
          </Link>
        </div>

      </div>
    </main>
  );
}