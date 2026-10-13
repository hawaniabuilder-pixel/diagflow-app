import type { Metadata } from 'next'

// Les liens d'invitation sont secrets : on demande aux moteurs de recherche de ne pas les indexer
export const metadata: Metadata = {
  title: 'Invitation — Vizion',
  robots: { index: false, follow: false },
}

export default function LayoutInvitation({ children }: { children: React.ReactNode }) {
  return children
}
