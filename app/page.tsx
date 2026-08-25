import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
