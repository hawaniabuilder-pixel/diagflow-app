import { Metadata } from 'next';
import Link from 'next/link'; // ⚠️ Import obligatoire pour le lien retour

export const metadata: Metadata = {
  title: 'Contact – Vizion Scan',
  description: 'Parlez-nous de votre besoin en diagnostic PME ou abonnement consultant.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      {/* Conteneur centré */}
      <div className="max-w-md w-full space-y-8 text-center">
        
        {/* Titre principal */}
        <h1 className="text-4xl font-bold tracking-tight">
          Contactez Vizion
        </h1>
        
        {/* Sous-titre explicatif */}
        <p className="text-lg text-gray-400">
          Une question ? Un devis rapide ?<br/>
          Réponse garantie sous 24h ouvrées.
        </p>
        
        {/* Bouton Email Direct */}
        <a 
          href="mailto:contact@vizionscan.com" 
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-all transform hover:-translate-y-1 active:scale-[0.98]"
        >
          ✉️ Envoyer un email
        </a>

        {/* Lien Retour Accueil */}
        <div className="pt-8 border-t border-gray-800 mt-8">
           <Link href="/" className="text-sm text-gray-500 hover:text-white transition-colors underline decoration-dotted">
             ← Retour à l'accueil
           </Link>
        </div>

      </div>
    </main>
  );
}