import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MarquePedago from "@/components/MarquePedago";
import ChampMotDePasse from "@/components/ui/ChampMotDePasse";

export const metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-8 py-14">
      <div className="flex w-full max-w-[396px] flex-col gap-[26px]">
        <div className="flex flex-col items-center gap-3.5">
          <MarquePedago />
          <div className="flex flex-col items-center gap-[3px]">
            <span className="font-display text-[23px] font-bold tracking-[-0.01em] text-ink">
              Pédago
            </span>
            <span className="text-sm text-slate-light">
              Espace formateur · OFPPT
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface px-7 py-[30px] shadow-detachee">
          <div className="flex flex-col gap-[5px]">
            <h1 className="font-display text-[21px] font-semibold leading-tight text-ink">
              Connexion
            </h1>
            <span className="text-[14.5px] text-slate-light">
              Utilisez l&apos;adresse fournie par votre établissement.
            </span>
          </div>

          {params.error ? (
            <p
              role="alert"
              className="rounded-[10px] border border-tint-alert-strong bg-alert-wash px-4 py-3 text-sm text-coral-dark"
            >
              {params.error}
            </p>
          ) : null}

          <form action={signIn} className="flex flex-col gap-5">
            <label htmlFor="email" className="flex flex-col gap-[7px]">
              <span className="text-sm font-semibold text-body">
                Adresse e-mail
              </span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="prenom.nom@ofppt.ma"
                className="rounded-[9px] border border-border-strong bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
              />
            </label>

            <label htmlFor="password" className="flex flex-col gap-[7px]">
              <span className="text-sm font-semibold text-body">
                Mot de passe
              </span>
              <ChampMotDePasse
                id="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-[10px] border border-ink bg-ink px-5 py-3.5 text-[15px] font-semibold text-white transition-colors duration-150 ease-out hover:border-ofppt-ink-dark hover:bg-ofppt-ink-dark focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
            >
              Se connecter
            </button>
          </form>
        </div>

        <span className="text-center text-[13px] text-muted">
          Office de la Formation Professionnelle et de la Promotion du Travail
        </span>
      </div>
    </main>
  );
}
