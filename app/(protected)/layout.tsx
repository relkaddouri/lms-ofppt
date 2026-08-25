import { getUser, getCurrentUserRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getCurrentUserRole();

  return (
    <AppShell email={user.email ?? null} role={role}>
      {children}
    </AppShell>
  );
}
