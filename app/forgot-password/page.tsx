export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ocean text-white p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold">Mot de passe oublié ?</h1>
        <p className="text-gray-400">
          Cette fonctionnalité arrive bientôt. Pour l'instant, contactez-nous directement.
        </p>
        <a href="/login" className="inline-block px-6 py-3 bg-coral hover:bg-coral-hover rounded-lg font-bold transition-colors">
          Retour à la connexion
        </a>
      </div>
    </div>
  );
}