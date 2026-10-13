import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indique à Next.js que la racine du projet est CE dossier (diagnostic-ia-clean),
  // et non le dossier parent C:\projets qui contient un autre package-lock.json.
  // Cela fait disparaître l'avertissement "Detected additional lockfiles" au démarrage.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
