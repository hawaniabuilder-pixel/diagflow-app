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
          Écrivez-nous directement. Réponse sous 24h.
        </p>

        {/* L'EMAIL EN GROS - Solution qui marche toujours */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 my-8">
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Notre adresse email :</p>
          
          <a 
            href="mailto:contact@vizionscan.com" 
            className="block text-2xl md:text-3xl font-mono text-blue-400 hover:text-blue-300 break-all select-all"
          >
            contact@vizionscan.com
          </a>
          
          <p className="mt-4 text-xs text-gray-500 italic">
            👆 Cliquez sur l'adresse ci-dessus.<br/>
            Si rien ne se passe, sélectionnez-la et copiez-la (Ctrl+C) dans votre boîte mail.
          </p>
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