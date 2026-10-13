import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- PALETTE DIAGFLOW 2026 ---
        
        // Primaire : Fond sombre & Structure
        ocean: {
          DEFAULT: '#0F172A', // Bleu nuit profond (bg principal)
          light: '#1E293B',   // Slate-800 (cartes, sidebar)
          lighter: '#334155', // Slate-700 (borders, inputs)
        },
        
        // Accent Tech : IA, Données, Liens internes
        electric: {
          DEFAULT: '#06B6D4', // Cyan vif (scores, graphiques, liens)
          soft: '#22D3EE',    // Hover states
          dark: '#0891B2',    // Textes sur fond clair si besoin
        },
        
        // CTA Conversion : Urgence, Action, Achat
        coral: {
          DEFAULT: '#FF6B35', // Orange corail (TOUS les boutons d'action majeurs)
          hover: '#E55A2B',   // État survol souris
          glow: 'rgba(255, 107, 53, 0.4)', // Ombre portée lumineuse
        },
        
        // Succès / Validation : ROI positif, Coches vertes
        emerald: {
          DEFAULT: '#10B981', // Vert émeraude moderne
          soft: '#34D399',
        },
        
        // Texte & Neutres (Accessibilité WCAG AA+)
        text: {
          primary: '#F8FAFC',   // Blanc cassé doux (titres H1/H2)
          secondary: '#CBD5E1', // Gris clair (sous-titres)
          muted: '#94A3B8',     // Gris moyen (labels, aide)
          disabled: '#64748B',  // Gris foncé (éléments inactifs)
        }
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'], // Pour les chiffres/scores
      },
      
      boxShadow: {
        'glow-coral': '0 0 20px rgba(255, 107, 53, 0.3)',
        'card-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
export default config