'use client'

// Lecture d'un diagnostic PARTAGÉ par un collègue de l'équipe (lecture seule).
// Adresse : /diagnostic/<id>/voir
// Supabase ne renvoie le diagnostic que s'il est à moi, ou partagé par quelqu'un de mon équipe.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { chargerMembres, chargerMonEquipe } from '../../../lib/equipe'
import RapportDiagnostic from '../../../components/RapportDiagnostic'
import BoutonImprimer from '../../../components/BoutonImprimer'
import type { DiagnosticIA } from '../../../lib/diagnostic-schema'

type Diagnostic = {
  id: string
  user_id: string
  entreprise: string
  secteur: string
  effectif: number | null
  statut: string
  updated_at: string
  diagnostic_json: DiagnosticIA | null
}

export default function VoirDiagnosticPartage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [chargement, setChargement] = useState(true)
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [auteur, setAuteur] = useState('')
  const [estAdmin, setEstAdmin] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace(`/login?suite=${encodeURIComponent(`/diagnostic/${id}/voir`)}`)
        return
      }
      const { data, error } = await supabase
        .from('diagnostics')
        .select('id, user_id, entreprise, secteur, effectif, statut, updated_at, diagnostic_json')
        .eq('id', id)
        .maybeSingle()
      if (error) console.error('[voir] Lecture impossible :', error)
      if (data && data.user_id === session.user.id) {
        // C'est mon propre diagnostic : on l'ouvre dans l'éditeur habituel
        router.replace(`/diagnostic?id=${id}`)
        return
      }
      if (data) {
        const [membres, { equipe }] = await Promise.all([chargerMembres(), chargerMonEquipe()])
        setAuteur(membres.find((m) => m.user_id === data.user_id)?.nom ?? 'un membre de l’équipe')
        setEstAdmin(equipe?.mon_role === 'admin')
      }
      setDiag((data as Diagnostic) ?? null)
      setChargement(false)
    }
    init()
  }, [id, router])

  if (chargement) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-300">Chargement…</main>
  }

  if (!diag) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
        <div className="max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
          <p role="alert" className="text-gray-200">Diagnostic introuvable : il n’est peut-être plus partagé avec l’équipe.</p>
          <a href="/dashboard" className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-700">← Tableau de bord</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pb-16 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-6 print:hidden">
          <a href="/dashboard" className="text-lg font-bold text-blue-400">Vizion</a>
          <a href="/dashboard#partages" className="text-sm text-gray-300 hover:text-white">← Tableau de bord</a>
        </header>

        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-purple-700 bg-purple-950/40 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-sm font-semibold text-purple-200">👥 Partagé par {auteur} · lecture seule</p>
            <h1 className="mt-1 text-2xl font-bold">{diag.entreprise}</h1>
            <p className="text-sm text-gray-300">
              {[diag.secteur, diag.effectif ? `${diag.effectif} salariés` : null].filter(Boolean).join(' · ')}
              {' · '}mis à jour le {new Date(diag.updated_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {estAdmin && diag.diagnostic_json && (
              <a href={`/diagnostic/${diag.id}/relecture`}
                className="rounded-lg border border-amber-500 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20">
                ✏️ Modifier (Admin)
              </a>
            )}
            {diag.diagnostic_json && <BoutonImprimer />}
          </div>
        </div>

        {diag.diagnostic_json ? (
          <RapportDiagnostic d={diag.diagnostic_json} mode="consultant" />
        ) : (
          <p className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-300">
            📝 Ce diagnostic n’a pas encore été analysé par l’IA : il n’y a rien à afficher pour l’instant.
          </p>
        )}
      </div>
    </main>
  )
}
