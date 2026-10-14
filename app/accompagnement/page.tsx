'use client';

export default function AccompagnementPage() {
  const LINK_COACHING = 'https://buy.stripe.com/14AbJ2j0geBabigd9u1WY0'; 
  const LINK_KICKOFF = 'https://buy.stripe.com/7sY4gAd622SsbiggLG1wY01';   
  const LINK_TRANSFORMATION = 'https://buy.stripe.com/9B6cN60jg0kk3P08TelwY02'; 
  
  return (
    <main className="min-h-screen bg-ocean text-text-primary p-4 md:p-8">
      {/* CONTENEUR CENTRAL */}
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* EN-TÊTE IMPACTANT */}
        <header className="text-center space-y-4 pt-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Votre diagnostic chiffre votre potentiel.<br/>
            <span className="bg-gradient-to-r from-electric to-emerald bg-clip-text text-transparent italic">L'accompagnement le transforme en résultats.</span>
          </h1>
          
          <p className="text-lg text-text-secondary max-w-3xl mx-auto">
            Consultant indépendant : 150-300 €/h · Agence : 2 500-6 000 € · DiagFlow : dès 79 €/mois
          </p>
        </header>

        {/* GRILLE DES OFFRES PREMIUM */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* CARTE 1 : COACHING MENSUEL (LE PLUS CHOISI) */}
          <article className="relative rounded-2xl border border-emerald/30 bg-ocean-light p-8 shadow-card-dark hover:border-emerald transition-all duration-300 group overflow-hidden">
            {/* Badge Vedette */}
            <div className="absolute top-0 right-0 m-4 px-3 py-1 rounded-full bg-emerald/20 border border-emerald/40 text-xs font-bold uppercase tracking-wider text-emerald backdrop-blur-sm">
              ★ Le plus choisi
            </div>
            
            <h2 className="text-2xl font-bold mb-2 text-white">Coaching mensuel</h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-electric">79 €</span>
              <span className="text-sm text-text-muted">HT / mois</span>
            </div>
            
            <ul className="space-y-3 text-sm text-text-secondary mb-8">
              <li className="flex items-center gap-2"><span className="text-emerald">✓</span> Tout le plan Solo inclus</li>
              <li className="flex items-center gap-2"><span className="text-emerald">✓</span> 1 session visio d'1 h/mois</li>
              <li className="flex items-center gap-2"><span className="text-emerald">✓</span> Support WhatsApp 5 j/7</li>
              <li className="flex items-center gap-2"><span className="text-emerald">✓</span> Revue KPI trimestrielle</li>
            </ul>

            <a href={LINK_COACHING} target="_blank" rel="noopener noreferrer" 
               className="block w-full text-center rounded-xl bg-coral hover:bg-coral-hover text-white font-bold py-4 shadow-glow-coral transition-all active:scale-[0.98]">
              Réserver ma place Coaching →
            </a>
            <p className="mt-3 text-xs text-center text-text-muted">🎁 Fondateurs : 1er mois à 49 € · 10 places seulement</p>
          </article>

          {/* CARTE 2 : KICKOFF 90 JOURS (PONCTUEL) */}
          <article className="rounded-2xl border border-ocean-lighter bg-ocean-light/50 p-8 shadow-card-dark hover:border-electric/50 transition-all duration-300">
            <h2 className="text-2xl font-bold mb-2 text-white">Kickoff 90 jours</h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-white">490 €</span>
              <span className="text-sm text-text-muted">unique</span>
            </div>
            
            <ul className="space-y-3 text-sm text-text-secondary mb-8">
              <li className="flex items-center gap-2"><span className="text-electric">→</span> Plan 90 jours personnalisé</li>
              <li className="flex items-center gap-2"><span className="text-electric">→</span> 2 sessions visio d'1 h</li>
              <li className="flex items-center gap-2"><span className="text-electric">→</span> Checklists mise en place outils</li>
              <li className="flex items-center gap-2"><span className="text-electric">→</span> Support email 60 jours</li>
            </ul>

            <a href={LINK_KICKOFF} target="_blank" rel="noopener noreferrer" 
               className="block w-full text-center rounded-xl border-2 border-electric/50 bg-transparent hover:bg-electric/10 text-electric font-bold py-4 transition-all active:scale-[0.98]">
              Choisir Kickoff
            </a>
             <p className="mt-3 text-xs text-center text-text-muted">Offert si upgrade Transformation sous 30 j</p>
          </article>

          {/* CARTE 3 : TRANSFORMATION TOTALE (PREMIUM) */}
          <article className="rounded-2xl border border-ocean-lighter bg-ocean-light/50 p-8 shadow-card-dark hover:border-coral/50 transition-all duration-300">
            <h2 className="text-2xl font-bold mb-2 text-white">Transformation totale</h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-white">590 €</span>
              <span className="text-sm line-through text-red-400 ml-2 opacity-60">690 €</span>
            </div>
            
            <ul className="space-y-3 text-sm text-text-secondary mb-8">
              <li className="flex items-center gap-2"><span className="text-coral">★</span> Tout le Kickoff inclus</li>
              <li className="flex items-center gap-2"><span className="text-coral">★</span> 4 sessions visio + WhatsApp 90 j</li>
              <li className="flex items-center gap-2"><span className="text-coral">★</span> Mise en place AVEC vous (écran partagé)</li>
              <li className="flex items-center gap-2"><span className="text-coral">★</span> Suivi KPI J30/J60/J90 + Rapport final</li>
            </ul>

            <a href={LINK_TRANSFORMATION} target="_blank" rel="noopener noreferrer" 
               className="block w-full text-center rounded-xl bg-coral hover:bg-coral-hover text-white font-bold py-4 shadow-glow-coral transition-all active:scale-[0.98]">
              Sécuriser mes résultats →
            </a>
             <p className="mt-3 text-xs text-center text-text-muted">Bonus Fondateurs : Session urgence (150€) + 30j WhatsApp offerts</p>
          </article>

        </section>
        {/* --- NOUVELLE SECTION : DIAGNOSTIC DIRECT POUR PME --- */}
        <section className="mt-16 rounded-2xl border border-coral/50 bg-ocean-light p-8 shadow-card-dark relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-coral/10 blur-full -z-10"></div>
          
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            ⚡ Besoin d'un avis expert MAINTENANT ? 
            <span className="px-2 py-0.5 rounded-full bg-coral text-xs font-black uppercase tracking-wide">Offre Limitée</span>
          </h3>
          
          <p className="text-text-secondary mb-6 max-w-2xl">
            Pas le temps de chercher un consultant ? Obtenez votre diagnostic complet en moins de 48h chrono, réalisé et relu personnellement par notre fondateur.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Carte Petit Budget */}
            <div className="rounded-xl border border-ocean-lighter bg-ocean/50 p-6 hover:border-electric transition-colors">
              <div className="flex justify-between items-baseline mb-4">
                <h4 className="font-bold text-lg text-white">Pack Essentiel</h4>
                <span className="text-2xl font-black text-electric">149 €</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-400 mb-6">
                <li>✓ Analyse IA approfondie</li>
                <li>✓ Relecture humaine garantie</li>
                <li>✓ Rapport PDF personnalisé</li>
                <li>✓ Livraison sous 48h ouvrées</li>
              </ul>
              <button onClick={() => window.location.href='/paiement-direct?type=essentiel'} 
                      className="w-full py-3 rounded-lg bg-transparent border-2 border-electric text-electric font-bold hover:bg-electric/10 transition-all active:scale-[0.98]">
                Commander mon Audit Flash →
              </button>
            </div>

            {/* Carte Premium */}
            <div className="rounded-xl border border-coral/50 bg-gradient-to-br from-ocean-light to-ocean p-6 shadow-glow-coral">
              <div className="flex justify-between items-baseline mb-4">
                <h4 className="font-bold text-lg text-white">Pack Stratégique+</h4>
                <span className="text-2xl font-black text-white">299 €</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-300 mb-6">
                <li>✓ Tout le Pack Essentiel inclus</li>
                <li>✓ Benchmark sectoriel exclusif</li>
                <li>✓ Plan d'action priorisé sur 90 jours</li>
                <li>✓ Appel de restitution 30 min avec le fondateur</li>
              </ul>
              <button onClick={() => window.location.href='/paiement-direct?type=strategique'} 
                      className="w-full py-3 rounded-lg bg-coral hover:bg-coral-hover text-white font-bold shadow-md transition-all active:scale-[0.98]">
                Sécuriser ma place Premium 🔥
              </button>
            </div>
          </div>
          
          <p className="mt-4 text-xs text-center text-muted italic">
            *Seulement 5 slots disponibles par semaine pour garantir la qualité de relecture humaine.
          </p>
        </section>
        {/* SECTION GARANTIE ROI & APPEL À L'ACTION FINAL */}
        <footer className="mt-16 rounded-2xl border border-emerald/20 bg-emerald/5 p-8 text-center backdrop-blur-md">
          <h3 className="text-xl font-bold text-emerald mb-2">Garantie ROI 90 jours</h3>
          <p className="text-text-secondary max-w-2xl mx-auto mb-6">
            Si notre accompagnement ne génère pas au moins 3x son coût en gains directs ou économies identifiées durant les 90 premiers jours, nous remboursons intégralement la différence. Zéro risque, 100% résultat mesurable.
          </p>
          
          <div className="inline-flex flex-col sm:flex-row gap-4 justify-center">
             <a href="/dashboard/settings" className="px-6 py-3 rounded-lg bg-ocean-light border border-ocean-lighter text-white font-semibold hover:border-electric transition-colors">
               Gérer mon abonnement logiciel
             </a>
             <a href={`mailto:hawaniabuilder@gmail.com?subject=Question%20Accompagnement`} className="px-6 py-3 rounded-lg bg-transparent border border-electric text-electric font-semibold hover:bg-electric/10 transition-colors">
               Poser une question préalable
             </a>
          </div>
        </footer>

      </div>
    </main>
  );
}