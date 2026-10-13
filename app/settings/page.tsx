// L'ancienne adresse /settings renvoie maintenant vers /dashboard/settings
// (pour que les anciens liens et favoris continuent de marcher).
import { redirect } from 'next/navigation'

export default function AncienneAdresseParametres() {
  redirect('/dashboard/settings')
}
