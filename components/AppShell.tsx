"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { AnneeScolaire } from "@/lib/annees";

export default function AppShell({
  email,
  role,
  notifications = 0,
  annees = [],
  anneeCouranteId = null,
  children,
}: {
  email: string | null;
  role: string | null;
  notifications?: number;
  annees?: AnneeScolaire[];
  anneeCouranteId?: string | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        email={email}
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          email={email}
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
