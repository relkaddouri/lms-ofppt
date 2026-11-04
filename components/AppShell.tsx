"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { AnneeScolaire } from "@/lib/annees";

/** Le cookie qui garde la barre latérale repliée d'une visite à l'autre. */
export const COOKIE_BARRE_REPLIEE = "barre_repliee";

export default function AppShell({
  email,
  nom = null,
  photoUrl = null,
  role,
  notifications = null,
  annees = [],
  anneeCouranteId = null,
  barreRepliee = false,
  children,
}: {
  email: string | null;
  nom?: string | null;
  photoUrl?: string | null;
  role: string | null;
  notifications?: { id: string; date: string }[] | null;
  annees?: AnneeScolaire[];
  anneeCouranteId?: string | null;
  /** Lu du cookie par le layout : la barre réduite à ses icônes. */
  barreRepliee?: boolean;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [repliee, setRepliee] = useState(barreRepliee);

  // Demande du 04/11/2026 : replier la barre pour laisser la place au
  // contenu. Le choix suit le formateur de page en page et d'un jour à
  // l'autre, sans appel au serveur : un cookie que le layout relira.
  function basculerBarre() {
    const suivant = !repliee;
    setRepliee(suivant);
    document.cookie = `${COOKIE_BARRE_REPLIEE}=${suivant ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        email={email}
        nom={nom}
        photoUrl={photoUrl}
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        repliee={repliee}
        onBasculer={basculerBarre}
      />
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-voile md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          notifications={notifications}
          annees={annees}
          anneeCouranteId={anneeCouranteId}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1200px] flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
