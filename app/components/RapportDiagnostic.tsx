/* @ts-nocheck */
// // Affichage d'un diagnostic, réutilisé à 3 endroits :
//  - mode "consultant" : sous le formulaire (app/diagnostic) et dans l'aperçu de la relecture
//  - mode "client"     : rapport public ouvert par le client (app/rapport/[id])
// Le consultant voit EXACTEMENT le même contenu que le client (c'est ce qu'il valide avant l'envoi).
// Le contenu dépend du TEMPLATE : Express (1 page), Complet (7 pages), Premium (15 pages).
import type { BenchmarkSecteur, DiagnosticIA, MoisSuivi, Positionnement, Recommandation } from '../lib/diagnostic-schema'
import { compteDansLesGains, SEMAINES_PAR_MOIS } from '../lib/calcul-financier'
import { TEMPLATES, templateSur } from '../lib/templates'

const euros = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// Sécurité : n'accepte que les liens http(s). Un lien "javascript:..." venant de l'IA serait dangereux.
function lienSur(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined
}

const COULEUR_URGENCE = { faible: 'bg-gray-600', moyenne: 'bg-yellow-700', élevée: 'bg-red-700' } as const

// « vide » : le texte affiché quand une case de la matrice n'a aucune solution (au lieu d'un simple tiret)
const QUADRANTS: { cle: Recommandation['quadrant']; titre: string; aide: string; vide: string; bord: string; fond: string; texte: string }[] = [
  { cle: 'quick_win', titre: '⚡ Quick wins', aide: 'Effort faible · impact élevé → à faire en premier', vide: 'Aucune pour l’instant.', bord: 'border-green-600', fond: 'bg-green-950/40', texte: 'text-green-300' },
  { cle: 'projet_strategique', titre: '🎯 Projets stratégiques', aide: 'Effort élevé · impact élevé → à planifier', vide: 'Aucun pour l’instant.', bord: 'border-blue-600', fond: 'bg-blue-950/40', texte: 'text-blue-300' },
  { cle: 'optimisation_simple', titre: '🔧 Optimisations simples', aide: 'Effort faible · impact modéré → si le temps le permet', vide: 'Aucune pour l’instant.', bord: 'border-yellow-600', fond: 'bg-yellow-950/30', texte: 'text-yellow-200' },
  { cle: 'a_eviter', titre: '⛔ À éviter pour l’instant', aide: 'Effort élevé · impact faible → non compté dans les gains', vide: 'Rien à signaler : toutes les solutions proposées valent l’effort.', bord: 'border-red-700', fond: 'bg-red-950/30', texte: 'text-red-300' },
]

function Carte({ titre, children, className = '' }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`break-inside-avoid rounded-xl border border-gray-700 bg-gray-800 p-6 ${className}`}>
      <h3 className="text-lg font-semibold">{titre}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// --- Premium : benchmark secteur ---
const POSITIONNEMENTS: Record<Positionnement, { libelle: string; classe: string }> = {
  en_avance: { libelle: '🟢 En avance', classe: 'bg-green-900/70 text-green-200' },
  dans_la_moyenne: { libelle: '🟡 Dans la moyenne', classe: 'bg-yellow-900/60 text-yellow-100' },
  en_retard: { libelle: '🔴 En retard', classe: 'bg-red-900/60 text-red-200' },
}

function SectionBenchmark({ b }: { b: BenchmarkSecteur }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-amber-700/70 bg-gray-800 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">💎 Premium</p>
      <h3 className="mt-1 text-lg font-semibold">Où vous situez-vous dans votre secteur ?</h3>
      {b.resume && <p className="mt-3 text-gray-300">{b.resume}</p>}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {b.indicateurs.map((i, n) => {
          const pos = POSITIONNEMENTS[i.positionnement] ?? POSITIONNEMENTS.dans_la_moyenne
          return (
            <li key={n} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{i.indicateur}</p>
                <span className={`rounded px-2 py-0.5 text-xs ${pos.classe}`}>{pos.libelle}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-gray-400">Votre entreprise</dt><dd className="text-gray-100">{i.entreprise}</dd></div>
                <div><dt className="text-xs text-gray-400">Repère du secteur</dt><dd className="text-gray-100">{i.reference_secteur}</dd></div>
              </dl>
              {i.commentaire && <p className="mt-2 text-xs text-gray-300">{i.commentaire}</p>}
            </li>
          )
        })}
      </ul>
      {b.bonnes_pratiques.some((p) => p.trim()) && (
        <div className="mt-5 break-inside-avoid">
          <p className="text-sm font-semibold text-gray-200">Ce que font les entreprises les plus avancées du secteur</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-300">
            {b.bonnes_pratiques.filter((p) => p.trim()).map((p, n) => <li key={n}>★ {p}</li>)}
          </ul>
        </div>
      )}
      {b.avertissement && <p className="mt-4 text-xs italic text-gray-400">ℹ️ {b.avertissement}</p>}
    </section>
  )
}

// --- Premium : plan de suivi sur 3 mois ---
function SectionSuivi({ mois }: { mois: MoisSuivi[] }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-amber-700/70 bg-gray-800 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">💎 Premium</p>
      <h3 className="mt-1 text-lg font-semibold">Votre suivi sur 3 mois</h3>
      <ol className="mt-4 grid gap-4 lg:grid-cols-3">
        {mois.map((m) => (
          <li key={m.mois} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
            <p className="text-sm font-semibold text-amber-300">Mois {m.mois}</p>
            <p className="mt-1 font-medium">🎯 {m.objectif}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-200">
              {m.actions.filter((a) => a.trim()).map((a, n) => <li key={n}>☐ {a}</li>)}
            </ul>
            {m.indicateurs.some((i) => i.nom.trim()) && (
              <div className="mt-3 rounded-md bg-gray-800 p-3">
                <p className="text-xs font-semibold text-gray-300">Indicateurs de réussite</p>
                <ul className="mt-1 space-y-1 text-xs text-gray-300">
                  {m.indicateurs.filter((i) => i.nom.trim()).map((i, n) => <li key={n}>📈 {i.nom} : <strong className="text-green-300">{i.cible}</strong></li>)}
                </ul>
              </div>
            )}
            {m.point_de_suivi && <p className="mt-3 text-xs text-blue-200">📅 Point de suivi : {m.point_de_suivi}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function RapportDiagnostic({ d, mode }: { d: DiagnosticIA; mode: 'consultant' | 'client' }) {
  const f = d.impact_financier
  const recosParId = new Map(d.recommandations.map((r) => [r.id, r]))
  const template = templateSur(d.template) // anciens diagnostics sans template = Complet
  const infos = TEMPLATES[template]
  const express = template === 'express'
  // Les solutions « à éviter pour l'instant » sont montrées à part (et ne comptent pas dans les gains)
  const conseillees = d.recommandations.filter(compteDansLesGains)
  const ecartees = d.recommandations.filter((r) => !compteDansLesGains(r))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
            {mode === 'client' ? 'Vos résultats' : 'Résultat de l’analyse'}
            <span className={`ml-3 rounded-full px-2.5 py-0.5 text-xs normal-case tracking-normal ${template === 'premium' ? 'bg-amber-500/20 text-amber-200' : 'bg-blue-500/20 text-blue-200'}`}>
              {infos.emoji} Rapport {infos.nom}
            </span>
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{mode === 'client' ? 'Synthèse du diagnostic' : 'Diagnostic généré'}</h2>
        </div>
        {mode === 'consultant' && (
          <p className="text-sm text-gray-400">Ci-dessous : exactement ce que verra votre client.</p>
        )}
      </div>

      {d.synthese.accroche && (
        <p className="rounded-xl border border-blue-900 bg-blue-950/40 p-5 text-lg leading-8 text-blue-100">{d.synthese.accroche}</p>
      )}

      {/* Chiffres clés */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="break-inside-avoid rounded-xl border border-green-800 bg-green-950/40 p-5">
          <p className="text-sm text-green-300">Valeur du temps gagné</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{euros(f.impact_annuel)}<span className="text-base font-medium"> / an</span></p>
          <p className="mt-1 text-xs text-gray-300">soit {euros(f.impact_mensuel)} par mois (estimation)</p>
        </div>
        <div className="break-inside-avoid rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-sm text-gray-400">Temps libéré</p>
          <p className="mt-1 text-3xl font-bold">{f.total_heures_economisees_semaine.toLocaleString('fr-FR')} h<span className="text-base font-medium"> / semaine</span></p>
          <p className="mt-1 text-xs text-gray-300">pour vos équipes</p>
        </div>
        <div className="break-inside-avoid rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-sm text-gray-400">Gain net la 1ʳᵉ année</p>
          <p className="mt-1 text-3xl font-bold">{euros(f.roi_annuel)}</p>
          <p className="mt-1 text-xs text-gray-300">
            après {euros(f.cout_outils_annuel + f.cout_mise_en_place)} de coûts
            {f.retour_investissement_mois != null && f.cout_mise_en_place > 0 && ` · rentabilisé en ${f.retour_investissement_mois.toLocaleString('fr-FR')} mois`}
          </p>
        </div>
      </div>

      {/* Transparence : comment les chiffres sont calculés */}
      <details className="break-inside-avoid rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
        <summary className="cursor-pointer font-medium text-gray-200">ℹ️ Comment ces chiffres sont-ils calculés ?</summary>
        <ul className="mt-3 space-y-1.5">
          <li>
            • <strong>Temps libéré</strong> : somme des heures gagnées estimées pour chaque solution recommandée
            {ecartees.length > 0 && ' (les solutions « à éviter pour l’instant » ne sont pas comptées, ni dans le temps ni dans les coûts)'}.
          </li>
          <li>
            • <strong>Valeur du temps gagné</strong> : {f.total_heures_economisees_semaine.toLocaleString('fr-FR')} h × {SEMAINES_PAR_MOIS} semaines
            × {f.taux_horaire} €/h × 12 mois = {euros(f.impact_annuel)}.
          </li>
          <li>
            • <strong>Coûts</strong> : abonnements {euros(f.cout_outils_mensuel)}/mois ({euros(f.cout_outils_annuel)}/an)
            + mise en place {euros(f.cout_mise_en_place)}.
          </li>
          <li>• <strong>Gain net</strong> : valeur du temps gagné − coûts de la 1ʳᵉ année.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">
          Ces montants sont des estimations prudentes, basées sur l’entretien. Le temps libéré n’est un gain réel que s’il est réinvesti
          (clients, qualité, développement). Les prix des outils sont indicatifs (HT) et à confirmer auprès des éditeurs.
        </p>
      </details>

      {/* Synthèse */}
      <Carte titre="Synthèse">
        <p className="text-gray-300">{d.synthese.situation}</p>
        <p className="mt-2 text-gray-300"><strong className="text-white">Problème principal :</strong> {d.synthese.probleme_principal}</p>
        {!express && (
          <>
            <p className="mt-4 text-sm font-semibold text-gray-200">Les 3 actions prioritaires</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-300">
              {d.synthese.actions_prioritaires.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </>
        )}
      </Carte>

      {/* EXPRESS : les 3 actions prioritaires, chacune avec sa solution (tout tient sur 1 page) */}
      {express && (
        <section className="break-inside-avoid rounded-xl border border-blue-800 bg-gray-800 p-6">
          <h3 className="text-lg font-semibold">Vos 3 actions prioritaires</h3>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {d.synthese.actions_prioritaires.map((a, i) => {
              const r = d.recommandations[i]
              const lien = r ? lienSur(r.lien_site) : undefined
              return (
                <li key={i} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
                  <p className="flex items-start gap-2 font-medium">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold">{i + 1}</span>
                    {a}
                  </p>
                  {r && (
                    <div className="mt-3 text-sm">
                      {lien
                        ? <a href={lien} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-300 hover:underline">{r.nom_outil}<span className="sr-only"> (site de l’éditeur, nouvel onglet)</span></a>
                        : <span className="font-semibold text-blue-200">{r.nom_outil}</span>}
                      <p className="mt-1 font-medium text-green-300">✔ {r.benefice_concret}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {euros(r.cout_mensuel_eur)}/mois HT{r.cout_mise_en_place_eur > 0 && ` + ${euros(r.cout_mise_en_place_eur)} de mise en place`}
                        {' · '}{r.heures_economisees_semaine} h/sem. gagnées
                      </p>
                      {r.alerte_rgpd && <p className="mt-1 text-xs text-yellow-200">⚠ RGPD : {r.alerte_rgpd}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* EXPRESS : pour aller plus loin (le rapport Complet) */}
      {express && (
        <section className="break-inside-avoid rounded-xl border border-dashed border-gray-600 p-5 text-sm text-gray-300">
          <p className="font-semibold text-gray-100">📘 Aller plus loin</p>
          <p className="mt-1">
            Le diagnostic <strong>Complet</strong> détaille tous les points qui vous font perdre du temps, la matrice effort / impact,
            les outils recommandés un par un et un plan d’action sur 4 jours. Parlez-en à votre consultant.
          </p>
        </section>
      )}

      {!express && (
        <>
        {/* Points de friction */}
        <Carte titre={`Ce qui vous fait perdre du temps (${d.points_friction.length})`}>
          <ul className="grid gap-4 md:grid-cols-2">
            {d.points_friction.map((p) => (
              <li key={p.id} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.titre}</span>
                  <span className={`rounded px-2 py-0.5 text-xs text-white ${COULEUR_URGENCE[p.urgence] ?? 'bg-gray-600'}`}>urgence {p.urgence}</span>
                  <span className="text-xs text-gray-300">≈ {p.impact_heures_semaine} h/sem. perdues</span>
                </div>
                <p className="mt-2 text-sm text-gray-300">{p.description}</p>
              </li>
            ))}
          </ul>
        </Carte>

        {/* Matrice effort / impact */}
        <Carte titre="Par où commencer ? La matrice effort / impact">
          <div className="grid gap-3 sm:grid-cols-2">
            {QUADRANTS.map((q) => {
              const recos = d.recommandations.filter((r) => r.quadrant === q.cle)
              return (
                <div key={q.cle} className={`break-inside-avoid rounded-lg border-2 p-4 ${q.bord} ${q.fond}`}>
                  <p className={`font-semibold ${q.texte}`}>{q.titre}</p>
                  <p className="text-xs text-gray-300">{q.aide}</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-100">
                    {recos.length ? recos.map((r) => <li key={r.id}>• {r.nom_outil}</li>) : <li className="text-gray-400">{q.vide}</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </Carte>

        {/* Solutions recommandées */}
        <Carte titre={`Solutions recommandées (${conseillees.length})`}>
          <ul className="grid gap-4 md:grid-cols-2">
            {conseillees.map((r) => {
              const quadrant = QUADRANTS.find((q) => q.cle === r.quadrant)
              const lien = lienSur(r.lien_site)
              return (
                <li key={r.id} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {lien
                      ? <a href={lien} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-300 hover:underline">{r.nom_outil}<span className="sr-only"> (site de l’éditeur, nouvel onglet)</span></a>
                      : <span className="font-semibold text-blue-200">{r.nom_outil}</span>}
                    {quadrant && <span className={`text-xs ${quadrant.texte}`}>{quadrant.titre}</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-300">{r.fonction}</p>
                  <p className="mt-2 text-sm font-medium text-green-300">✔ {r.benefice_concret}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {euros(r.cout_mensuel_eur)}/mois HT
                    {r.cout_mise_en_place_eur > 0 && ` + ${euros(r.cout_mise_en_place_eur)} de mise en place`}
                    {' · '}{r.heures_economisees_semaine} h/sem. gagnées · complexité {r.complexite}
                  </p>
                  {r.alerte_rgpd && <p className="mt-2 text-xs text-yellow-200">⚠ RGPD : {r.alerte_rgpd}</p>}
                </li>
              )
            })}
          </ul>
          {/* Envisagées mais déconseillées pour l'instant (case ⛔ de la matrice) */}
          {ecartees.length > 0 && (
            <div className="mt-5 break-inside-avoid rounded-lg border border-red-900/70 bg-red-950/20 p-4">
              <p className="text-sm font-semibold text-red-300">⛔ Envisagé, mais déconseillé pour l’instant ({ecartees.length})</p>
              <ul className="mt-2 space-y-2 text-sm">
                {ecartees.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-gray-100">{r.nom_outil}</span>
                    {(r.benefice_concret || r.fonction) && <span className="text-gray-300"> — {r.benefice_concret || r.fonction}</span>}
                    <span className="block text-xs text-gray-400">
                      {euros(r.cout_mensuel_eur)}/mois HT{r.cout_mise_en_place_eur > 0 && ` + ${euros(r.cout_mise_en_place_eur)} de mise en place`} · complexité {r.complexite}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">Ces solutions ne sont comptées ni dans le temps gagné, ni dans les coûts ci-dessus.</p>
            </div>
          )}
        </Carte>

        {/* Plan 4 jours */}
        <Carte titre="Votre plan d’action sur 4 jours">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((jour) => (
              <li key={jour} className="break-inside-avoid rounded-lg bg-gray-900/60 p-4">
                <p className="text-sm font-semibold text-blue-300">Jour {jour}</p>
                <ul className="mt-2 space-y-3">
                  {d.plan_4_jours.filter((a) => a.jour === jour).map((a, i) => (
                    <li key={i} className="text-sm">
                      <p className="text-gray-100">☐ {a.action}</p>
                      <p className="mt-1 text-xs text-gray-400">{a.outil_requis} · {a.temps_estime_minutes} min · {a.responsable}</p>
                      {a.critere_succes && <p className="mt-1 text-xs text-green-300">🎯 {a.critere_succes}</p>}
                    </li>
                  ))}
                  {d.plan_4_jours.filter((a) => a.jour === jour).length === 0 && <li className="text-xs text-gray-400">—</li>}
                </ul>
              </li>
            ))}
          </ol>
        </Carte>

        {/* Opportunités */}
        {d.opportunites.length > 0 && (
          <Carte titre="Pour aller plus loin (6 à 12 mois)">
            <ul className="grid gap-4 md:grid-cols-3">
              {d.opportunites.map((o, i) => (
                <li key={i} className="break-inside-avoid rounded-lg border-l-2 border-blue-600 bg-gray-900/60 p-4">
                  <p className="font-medium">{o.titre}</p>
                  <p className="mt-1 text-xs text-blue-200">⏱ {o.delai_mise_en_oeuvre}</p>
                  <p className="mt-2 text-sm text-gray-300">{o.description}</p>
                  {o.prerequis.length > 0 && <p className="mt-2 text-xs text-gray-400">Prérequis : {o.prerequis.join(', ')}</p>}
                </li>
              ))}
            </ul>
          </Carte>
        )}
        </>
      )}

      {/* PREMIUM : benchmark secteur et suivi sur 3 mois */}
      {template === 'premium' && d.benchmark_secteur && <SectionBenchmark b={d.benchmark_secteur} />}
      {template === 'premium' && d.suivi_3_mois && d.suivi_3_mois.length > 0 && <SectionSuivi mois={d.suivi_3_mois} />}

      {/* Points de vigilance RGPD */}
      {d.alertes_rgpd.length > 0 && (
        <section className="break-inside-avoid rounded-xl border border-yellow-800 bg-yellow-950/20 p-6">
          <h3 className="text-lg font-semibold">🔒 Points de vigilance RGPD</h3>
          <ul className="mt-4 space-y-3">
            {d.alertes_rgpd.map((a, i) => (
              <li key={i} className="text-sm text-gray-300">
                <strong className="text-yellow-200">{a.nom_outil}</strong> : {a.vigilance_requise}
                {a.mesures_recommandees.length > 0 && <span className="text-gray-400"> → {a.mesures_recommandees.join(' · ')}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === 'consultant' && recosParId.size === 0 && (
        <p className="rounded-lg border border-yellow-800 bg-yellow-950/40 p-4 text-sm text-yellow-200">⚠️ Aucune recommandation : ajoutez-en dans l’écran de relecture.</p>
      )}
    </div>
  )
}
