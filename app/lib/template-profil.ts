// Lire / enregistrer le template choisi (navigateur uniquement).
//  - template par défaut du consultant : colonne profils.template_defaut
//  - template d'un diagnostic          : colonne diagnostics.template
// Si le script supabase/08_templates.sql n'a pas encore été exécuté, on continue avec « Complet ».
import { supabase } from './supabase'
import { TEMPLATE_PAR_DEFAUT, templateSur, type TemplateId } from './templates'

const colonneAbsente = (message: string) => /template/i.test(message) && /column|colonne|schema cache|does not exist/i.test(message)

export async function chargerTemplateDefaut(): Promise<{ template: TemplateId; disponible: boolean }> {
  const { data, error } = await supabase.from('profils').select('template_defaut').maybeSingle()
  if (error) {
    if (!colonneAbsente(error.message ?? '')) console.warn('[template] Lecture impossible :', error.message)
    return { template: TEMPLATE_PAR_DEFAUT, disponible: !colonneAbsente(error.message ?? '') }
  }
  return { template: templateSur(data?.template_defaut), disponible: true }
}

// Renvoie un message d'erreur en français, ou null si tout va bien
export async function enregistrerTemplateDefaut(userId: string, template: TemplateId): Promise<string | null> {
  const { error } = await supabase.from('profils').upsert({ id: userId, template_defaut: template })
  if (!error) return null
  console.error('[template] Enregistrement impossible :', error)
  return colonneAbsente(error.message ?? '')
    ? 'Exécutez d’abord le fichier supabase/08_templates.sql dans Supabase (SQL Editor).'
    : 'L’enregistrement a échoué. Vérifiez votre connexion et réessayez.'
}

// Template d'un diagnostic précis (sans bloquer si la colonne n'existe pas encore)
export async function enregistrerTemplateDiagnostic(id: string, template: TemplateId): Promise<boolean> {
  const { error } = await supabase.from('diagnostics').update({ template }).eq('id', id)
  if (error && !colonneAbsente(error.message ?? '')) console.warn('[template] Diagnostic non mis à jour :', error.message)
  return !error
}
