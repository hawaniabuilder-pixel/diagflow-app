'use client'; // <--- TRÈS IMPORTANT : Dit à Next.js que cette page est interactive

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
          Une question ? Un devis rapide ?<br/>
          Réponse garantie sous 24h ouvrées.
        </p>

        {/* BLOC EMAIL SIMPLE ET EFFICACE */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 my-8 shadow-xl relative group hover:border-blue-500 transition-colors duration-300">
          
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-3 font-semibold">Notre adresse email :</p>
          
          {/* L'EMAIL EN GROS - Texte simple, copiable */}
          <span 
            className="block text-2xl md:text-3xl font-mono text-blue-400 break-all select-all cursor-pointer hover:text-blue-300 transition-colors z-10 relative"
            onClick={() => navigator.clipboard.writeText('contact@vizionscan.com')}
          >
            contact@vizionscan.com
          </span>
          
          {/* INSTRUCTIONS CORRIGÉES (Pas de symbole ">") */}
          <p className="mt-6 text-xs text-gray-500 italic">
            👆 Cliquez sur l'adresse ci-dessus pour la sélectionner.<br/>
            Puis faites un clic droit et choisissez "Copier".<br/>
            Enfin, ouvrez Gmail ou Outlook et collez-la (Ctrl+V).
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