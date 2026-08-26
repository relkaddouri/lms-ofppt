"use client";

/**
 * Dernier filet : une erreur survenue dans le layout racine lui-même.
 * Ce composant remplace tout le document, il doit donc porter html et body,
 * et ne peut pas s'appuyer sur les styles globaux ni sur les composants
 * partagés — d'où des styles en ligne, seule exception assumée au design
 * system, dont les variables CSS ne sont pas garanties chargées ici.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Erreur globale :", error);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F6F7F9",
          color: "#16241F",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            L&apos;application n&apos;a pas pu démarrer
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>
            Une erreur inattendue est survenue. Réessayez dans un instant.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#0E3B2E",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
