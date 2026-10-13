'use client'

// Envoi du logo du consultant.
//  - Glisser-déposer une image dans la zone, OU cliquer pour choisir un fichier
//  - Aperçu immédiat (avant même la fin de l'envoi), sur fond sombre et sur fond clair
//  - Vérifications : PNG / JPG / WebP, 2 Mo maximum, vraie image lisible
//  - Bouton « Supprimer le logo » (avec confirmation)
//  - Stockage dans Supabase Storage, espace "logos", dossier logos/<id du consultant>/
//
// La page qui l'utilise fournit "enregistrer(url)" : elle range l'adresse du logo dans la table "profils".

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export const LOGO_TAILLE_MAX = 2 * 1024 * 1024 // 2 Mo
const TYPES_ACCEPTES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const EXTENSIONS_ACCEPTEES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

type Props = {
  userId: string
  logoUrl: string | null // logo actuellement enregistré
  enregistrer: (url: string | null) => Promise<boolean> // range l'adresse dans "profils" ; renvoie true si OK
  enLigne?: boolean
}

type Etat = 'repos' | 'verification' | 'envoi' | 'suppression'

// "1,4 Mo" ou "850 Ko"
function taille(octets: number) {
  return octets >= 1024 * 1024
    ? `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`
}

// Type réel du fichier (certains navigateurs ne donnent pas le type lors d'un glisser-déposer)
function typeDuFichier(fichier: File): string | null {
  if (TYPES_ACCEPTES[fichier.type]) return fichier.type
  const extension = fichier.name.split('.').pop()?.toLowerCase() ?? ''
  return fichier.type === '' ? EXTENSIONS_ACCEPTEES[extension] ?? null : null
}

// Vérifie que l'image s'ouvre vraiment (fichier non abîmé) et renvoie sa taille en pixels
function lireDimensions(url: string): Promise<{ largeur: number; hauteur: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ largeur: img.naturalWidth, hauteur: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Chemin du fichier dans l'espace "logos" à partir de son adresse publique
function cheminDepuisUrl(url: string) {
  const morceau = url.split('/logos/')[1]?.split('?')[0]
  return morceau ? decodeURIComponent(morceau) : null
}

function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
}

export default function LogoUpload({ userId, logoUrl, enregistrer, enLigne = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [etat, setEtat] = useState<Etat>('repos')
  const [survol, setSurvol] = useState(false) // un fichier est glissé au-dessus de la zone
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [avertissement, setAvertissement] = useState('')
  const [confirmation, setConfirmation] = useState(false) // 2e clic pour supprimer
  // Aperçu local (image lue directement sur l'ordinateur) : "pour" = adresse en ligne une fois enregistrée
  const [apercu, setApercu] = useState<{ url: string; pour: string | null } | null>(null)

  // Libère la mémoire de l'aperçu local quand il n'est plus utilisé
  const urlApercu = apercu?.url
  useEffect(() => {
    if (!urlApercu) return
    return () => URL.revokeObjectURL(urlApercu)
  }, [urlApercu])

  // Si on lâche une image À CÔTÉ de la zone, le navigateur ne doit pas quitter la page pour l'ouvrir
  useEffect(() => {
    function bloquer(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', bloquer)
    window.addEventListener('drop', bloquer)
    return () => {
      window.removeEventListener('dragover', bloquer)
      window.removeEventListener('drop', bloquer)
    }
  }, [])

  const occupe = etat !== 'repos'
  // On montre l'aperçu local pendant l'envoi, puis tant qu'il correspond au logo enregistré (pas de clignotement)
  const imageAffichee = apercu && (apercu.pour === null || apercu.pour === logoUrl) ? apercu.url : logoUrl

  function ouvrirSelecteur() {
    if (!occupe) inputRef.current?.click()
  }

  async function traiter(fichiers: FileList | File[] | null | undefined) {
    const liste = Array.from(fichiers ?? [])
    if (liste.length === 0 || occupe) return
    const fichier = liste[0]
    setErreur('')
    setMessage('')
    setAvertissement('')
    setConfirmation(false)

    // 1) Vérifications
    if (!enLigne) {
      setErreur('Internet est coupé : l’envoi du logo a besoin d’internet.')
      return
    }
    const type = typeDuFichier(fichier)
    if (!type) {
      setErreur(`« ${fichier.name} » n’est pas accepté. Formats possibles : PNG, JPG ou WebP.`)
      return
    }
    if (fichier.size > LOGO_TAILLE_MAX) {
      setErreur(`Image trop lourde : ${taille(fichier.size)} (maximum 2 Mo). Astuce : réduisez-la sur squoosh.app ou tinypng.com.`)
      return
    }

    // 2) Aperçu immédiat + vérification que l'image s'ouvre
    setEtat('verification')
    const urlLocale = URL.createObjectURL(fichier)
    const dimensions = await lireDimensions(urlLocale)
    if (!dimensions) {
      URL.revokeObjectURL(urlLocale)
      setEtat('repos')
      setErreur('Cette image semble abîmée : impossible de l’ouvrir. Essayez un autre fichier.')
      return
    }
    setApercu({ url: urlLocale, pour: null })
    if (dimensions.largeur < 120 || dimensions.hauteur < 40) {
      setAvertissement(`Image petite (${dimensions.largeur} × ${dimensions.hauteur} px) : elle risque d’être floue. Idéal : au moins 400 px de large.`)
    }
    if (liste.length > 1) setAvertissement((a) => `${a ? `${a} ` : ''}Un seul fichier à la fois : seul « ${fichier.name} » est utilisé.`)

    // 3) Envoi dans Supabase Storage (nom unique à chaque fois : pas de vieux logo resté en cache)
    setEtat('envoi')
    const chemin = `${userId}/logo-${Date.now()}.${TYPES_ACCEPTES[type]}`
    const { error: erreurEnvoi } = await supabase.storage.from('logos').upload(chemin, fichier, {
      contentType: type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (erreurEnvoi) {
      console.error('[logo] Envoi impossible :', erreurEnvoi)
      setApercu(null)
      setEtat('repos')
      setErreur(/bucket|not found/i.test(erreurEnvoi.message ?? '')
        ? 'L’espace de stockage « logos » n’existe pas : exécutez supabase/04_parametres.sql dans Supabase.'
        : 'L’envoi du logo a échoué. Vérifiez votre connexion et réessayez.')
      return
    }

    // 4) On range l'adresse dans le profil, puis on fait le ménage
    const { data } = supabase.storage.from('logos').getPublicUrl(chemin)
    const ancien = logoUrl
    const ok = await enregistrer(data.publicUrl)
    if (!ok) {
      await supabase.storage.from('logos').remove([chemin]) // pas enregistré : on retire le fichier envoyé pour rien
      setApercu(null)
      setEtat('repos')
      setErreur('Le logo n’a pas pu être enregistré dans votre profil. Réessayez.')
      return
    }
    setApercu({ url: urlLocale, pour: data.publicUrl })
    const ancienChemin = ancien ? cheminDepuisUrl(ancien) : null
    if (ancienChemin) await supabase.storage.from('logos').remove([ancienChemin]) // l'ancien logo ne sert plus
    setEtat('repos')
    setMessage('✅ Logo enregistré')
  }

  async function supprimer() {
    if (!logoUrl || occupe) return
    if (!confirmation) {
      setConfirmation(true)
      return
    }
    setConfirmation(false)
    setErreur('')
    setMessage('')
    setAvertissement('')
    setEtat('suppression')
    const ancienChemin = cheminDepuisUrl(logoUrl)
    const ok = await enregistrer(null)
    if (!ok) {
      setEtat('repos')
      setErreur('La suppression a échoué. Vérifiez votre connexion et réessayez.')
      return
    }
    if (ancienChemin) await supabase.storage.from('logos').remove([ancienChemin])
    setApercu(null)
    setEtat('repos')
    setMessage('Logo supprimé')
  }

  // --- Glisser-déposer ---
  function surDragOver(e: React.DragEvent) {
    e.preventDefault() // indispensable pour autoriser le dépôt
    e.dataTransfer.dropEffect = occupe ? 'none' : 'copy'
    if (!survol && !occupe) setSurvol(true)
  }
  function surDragLeave(e: React.DragEvent) {
    // On ignore quand la souris passe sur un élément À L'INTÉRIEUR de la zone
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(false)
  }
  function surDrop(e: React.DragEvent) {
    e.preventDefault()
    setSurvol(false)
    traiter(e.dataTransfer.files)
  }

  const libelleEtat = etat === 'verification' ? 'Vérification…' : etat === 'envoi' ? 'Envoi en cours…' : etat === 'suppression' ? 'Suppression…' : ''

  return (
    <div className="space-y-4">
      {/* Zone de dépôt : on peut aussi cliquer dessus, ou y aller avec Tab puis Entrée */}
      <div
        role="button"
        tabIndex={occupe ? -1 : 0}
        aria-disabled={occupe || undefined}
        aria-describedby="logo-formats"
        aria-label={imageAffichee ? 'Changer le logo : glissez une image ici ou appuyez sur Entrée pour choisir un fichier' : 'Ajouter un logo : glissez une image ici ou appuyez sur Entrée pour choisir un fichier'}
        onClick={ouvrirSelecteur}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirSelecteur() } }}
        onDragEnter={surDragOver}
        onDragOver={surDragOver}
        onDragLeave={surDragLeave}
        onDrop={surDrop}
        className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
          ${survol ? 'border-blue-400 bg-blue-500/15' : 'border-gray-600 bg-gray-900 hover:border-gray-400'}
          ${occupe ? 'cursor-wait' : ''}`}
      >
        {imageAffichee ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageAffichee} alt="Aperçu de votre logo" className={`max-h-24 max-w-full object-contain transition ${occupe ? 'opacity-40' : ''}`} />
        ) : (
          <span aria-hidden className="text-4xl">🖼️</span>
        )}

        {survol ? (
          <p className="font-semibold text-blue-200">Lâchez l’image ici</p>
        ) : !occupe && (
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-blue-300">{imageAffichee ? 'Changer le logo' : 'Glissez votre logo ici'}</span>
            <span className="text-gray-400"> {imageAffichee ? '(glissez une image ou cliquez)' : 'ou cliquez pour choisir un fichier'}</span>
          </p>
        )}

        {occupe && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-xl bg-gray-950/60 text-sm font-medium">
            <Spinner /> {libelleEtat}
          </div>
        )}
      </div>
      {/* Le vrai sélecteur de fichier, caché (placé hors de la zone pour ne pas s'ouvrir 2 fois) */}
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-hidden
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        onChange={(e) => { traiter(e.target.files); e.target.value = '' }} />
      <p id="logo-formats" className="text-xs text-gray-400">PNG, JPG ou WebP · 2 Mo maximum · fond transparent conseillé · enregistré dès l’import</p>

      {/* Aperçu sur les 2 fonds : rapport en ligne (sombre) et PDF imprimé (clair) */}
      {imageAffichee && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex h-16 items-center justify-center rounded-lg border border-gray-700 bg-gray-950 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageAffichee} alt="" className="max-h-12 max-w-full object-contain" />
          </div>
          <div className="flex h-16 items-center justify-center rounded-lg border border-gray-300 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageAffichee} alt="" className="max-h-12 max-w-full object-contain" />
          </div>
          <p className="text-center text-xs text-gray-400">Sur fond sombre</p>
          <p className="text-center text-xs text-gray-400">Sur fond clair</p>
        </div>
      )}

      {/* Messages */}
      <div aria-live="polite" className="space-y-2 text-sm">
        {message && <p className="text-green-400">{message}</p>}
        {avertissement && <p className="text-amber-300">⚠️ {avertissement}</p>}
      </div>
      {erreur && <p role="alert" className="rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {erreur}</p>}

      {/* Supprimer (2 clics pour éviter les erreurs) */}
      {logoUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={supprimer} disabled={occupe}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${confirmation ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-gray-600 text-gray-300 hover:border-red-700 hover:text-red-300'}`}>
            {confirmation ? 'Confirmer la suppression' : '🗑️ Supprimer le logo'}
          </button>
          {confirmation && (
            <button type="button" onClick={() => setConfirmation(false)}
              className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm text-gray-300 transition hover:text-white">
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  )
}
