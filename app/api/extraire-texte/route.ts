// API : POST /api/extraire-texte
// Reçoit un fichier .docx ou .pdf (transcription d'entretien) et renvoie son texte brut.
// Les fichiers .txt sont lus directement dans le navigateur, sans passer par ici.
// Le fichier n'est jamais enregistré : il est lu en mémoire puis oublié.
import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { FICHIER_MAX_OCTETS } from '../../lib/diagnostic-schema'

export const runtime = 'nodejs'

function erreur(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  // Vérification de la session (même principe que /api/diagnostic)
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return erreur('Connectez-vous pour importer un fichier.', 401)

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData.user) return erreur('Votre session a expiré. Reconnectez-vous.', 401)

  let fichier: File | null = null
  try {
    const formData = await request.formData()
    const valeur = formData.get('fichier')
    fichier = valeur instanceof File ? valeur : null
  } catch {
    return erreur('Envoi du fichier impossible.', 400)
  }
  if (!fichier) return erreur('Aucun fichier reçu.', 400)
  if (fichier.size > FICHIER_MAX_OCTETS) return erreur('Fichier trop volumineux (10 Mo maximum).', 413)

  const nom = fichier.name.toLowerCase()
  const buffer = Buffer.from(await fichier.arrayBuffer())

  try {
    let texte = ''
    if (nom.endsWith('.docx')) {
      const resultat = await mammoth.extractRawText({ buffer })
      texte = resultat.value
    } else if (nom.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const resultat = await extractText(pdf, { mergePages: true })
      texte = resultat.text
    } else {
      return erreur('Format non pris en charge. Utilisez .txt, .docx ou .pdf.', 415)
    }

    texte = texte.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!texte) {
      return erreur('Aucun texte trouvé dans ce fichier (un PDF scanné en image ne peut pas être lu).', 422)
    }

    console.log('[api/extraire-texte]', `${nom.split('.').pop()} lu — ${texte.length} caractères`)
    return Response.json({ success: true, data: { texte } })
  } catch (e) {
    console.error('[api/extraire-texte] Lecture impossible :', e)
    return erreur('Impossible de lire ce fichier. Est-il protégé ou endommagé ?', 422)
  }
}
