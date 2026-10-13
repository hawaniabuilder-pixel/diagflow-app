// MODE DÉMO : tester l'outil sans crédit IA.
// Le réglage est rangé dans le navigateur (localStorage) sous le nom "diagflow_demo_mode" = "true" / "false".
// Il ne concerne donc QUE ce navigateur, sur cet ordinateur.
import { useSyncExternalStore } from 'react'

export const CLE_MODE_DEMO = 'diagflow_demo_mode'
const EVENEMENT_CHANGEMENT = 'diagflow-demo-mode-change' // prévient les autres composants de la même page

// Lit le réglage (false si le navigateur bloque le stockage)
export function lireModeDemo(): boolean {
  try {
    return localStorage.getItem(CLE_MODE_DEMO) === 'true'
  } catch {
    return false
  }
}

// Active ou désactive le mode démo
export function changerModeDemo(actif: boolean) {
  try {
    localStorage.setItem(CLE_MODE_DEMO, actif ? 'true' : 'false')
  } catch {
    // stockage bloqué (navigation privée stricte) : le réglage ne sera pas gardé
  }
  window.dispatchEvent(new Event(EVENEMENT_CHANGEMENT))
}

// React est prévenu quand le réglage change : dans cette page ("événement maison")
// ou dans un autre onglet (événement "storage" du navigateur)
function sAbonner(prevenir: () => void) {
  const surStockage = (e: StorageEvent) => { if (e.key === CLE_MODE_DEMO) prevenir() }
  window.addEventListener(EVENEMENT_CHANGEMENT, prevenir)
  window.addEventListener('storage', surStockage)
  return () => {
    window.removeEventListener(EVENEMENT_CHANGEMENT, prevenir)
    window.removeEventListener('storage', surStockage)
  }
}

// À utiliser dans les composants : const modeDemo = useModeDemo()
export function useModeDemo(): boolean {
  return useSyncExternalStore(sAbonner, lireModeDemo, () => false)
}
