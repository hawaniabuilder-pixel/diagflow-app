"use client";

import { useState } from "react";
import { Save, Building2, CreditCard, CheckCircle2, Palette, Zap, UploadCloud } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [demoMode, setDemoMode] = useState(true); // Activé par défaut pour toi !
  
  const [formData, setFormData] = useState({
    nomComplet: "Faouzi Ahmada",
    nomCabinet: "DiagFlow",
    email: "faouzi.a12@yahoo.com",
    couleur: "#2563EB", // Bleu par défaut
    tauxHoraire: 55,
  });

  const handleSave = () => {
    setSaved(false);
    setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* En-tête avec Mode Démo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Paramètres</h1>
            <p className="text-gray-400">Configurez votre espace et personnalisez vos rapports.</p>
          </div>
          
          {/* Toggle Mode Démo */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${demoMode ? 'bg-purple-900/30 border-purple-700' : 'bg-gray-800 border-gray-700'}`}>
            <Zap className={`w-5 h-5 ${demoMode ? 'text-purple-400' : 'text-gray-500'}`} />
            <div>
              <p className="text-sm font-semibold text-white">Mode Démo</p>
              <p className="text-xs text-gray-400">Pas de clé API requise</p>
            </div>
            <button 
              onClick={() => setDemoMode(!demoMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${demoMode ? 'bg-purple-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${demoMode ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Message de succès */}
        {saved && (
          <div className="bg-green-900/40 border border-green-700/50 text-green-300 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-5 h-5" />
            Paramètres enregistrés avec succès !
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLONNE GAUCHE : FORMULAIRES */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Profil */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-white">Profil du cabinet</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Nom complet</label>
                  <input 
                    type="text" 
                    value={formData.nomComplet}
                    onChange={(e) => setFormData({...formData, nomComplet: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Nom du cabinet</label>
                  <input 
                    type="text" 
                    value={formData.nomCabinet}
                    onChange={(e) => setFormData({...formData, nomCabinet: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 2. Branding */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-5 h-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-white">Apparence & Marque</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Couleur principale</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={formData.couleur}
                      onChange={(e) => setFormData({...formData, couleur: e.target.value})}
                      className="h-10 w-20 bg-transparent border-0 cursor-pointer rounded"
                    />
                    <span className="text-gray-300 font-mono text-sm">{formData.couleur}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Logo du cabinet</label>
                  <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-gray-500 transition-colors cursor-pointer">
                    <UploadCloud className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Cliquez pour importer (PNG, JPG)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Mon Offre (Version Premium) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-white">Mon Offre</h2>
              </div>
              
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  PLAN SOLO
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">DiagFlow Starter</h3>
                <p className="text-gray-400 text-sm mb-6">Parfait pour démarrer et valider votre méthode.</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm">Diagnostics illimités en mode Démo</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm">Export PDF avec votre logo</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center text-[10px]">✕</div>
                    <span className="text-sm line-through">Marque blanche complète</span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">Gratuit</span>
                  <span className="text-gray-500 text-sm">pendant la bêta</span>
                </div>
                <p className="text-xs text-blue-400 mt-3 italic">* Tarif définitif communiqué au lancement officiel.</p>
              </div>
            </div>

          </div>

          {/* COLONNE DROITE : APERÇU EN DIRECT */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Aperçu du rapport</h3>
                
                {/* Mini fausse page de rapport */}
                <div className="bg-white text-gray-900 rounded-lg p-5 shadow-2xl transform scale-95 origin-top">
                  <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-3">
                    <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">DF</div>
                    <div>
                      <p className="font-bold text-sm">{formData.nomCabinet || "Nom du cabinet"}</p>
                      <p className="text-[10px] text-gray-500">Diagnostic IA PME</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <button 
                    className="w-full py-2 rounded text-white text-sm font-semibold transition-colors"
                    style={{ backgroundColor: formData.couleur }}
                  >
                    Prendre rendez-vous
                  </button>
                </div>

                <button 
                  onClick={handleSave}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20"
                >
                  <Save className="w-5 h-5" />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}