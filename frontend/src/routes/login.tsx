import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabaseConfigMissing, supabaseConfigMessage } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Autentificare — Oasis" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) void navigate({ to: "/dashboard", replace: true });
  }, [isLoading, navigate, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        await navigate({ to: "/dashboard", replace: true });
      } else {
        const hasSession = await signUp(email.trim(), password);
        if (hasSession) await navigate({ to: "/dashboard", replace: true });
        else setMessage("Verifică-ți adresa de email pentru a confirma contul.");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Autentificarea a eșuat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-neon/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-foreground"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-oasis glow-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          Oasis
        </Link>

        <div className="rounded-3xl glass p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-neon">
            Insula ta te așteaptă
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            {mode === "signin" ? "Bine ai revenit" : "Creează-ți contul"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Autentifică-te pentru a continua să-ți construiești oaza."
              : "Un cont nou îți păstrează progresul și misiunile."}
          </p>

          <div
            className="mt-6 grid grid-cols-2 rounded-xl bg-secondary/70 p-1"
            role="tablist"
            aria-label="Tip autentificare"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "signin" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            >
              Autentificare
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
            >
              Cont nou
            </button>
          </div>

          {supabaseConfigMissing ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-streak/40 bg-streak/10 px-4 py-3 text-sm text-foreground"
            >
              {supabaseConfigMessage}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-foreground">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-background/70 px-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-neon focus:ring-2 focus:ring-neon/20"
                  placeholder="nume@exemplu.ro"
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Parolă
                <span className="relative mt-2 block">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-background/70 px-4 pr-12 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-neon focus:ring-2 focus:ring-neon/20"
                    placeholder="Minimum 6 caractere"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="rounded-xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-foreground"
                >
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-oasis font-bold text-primary-foreground glow-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {mode === "signin" ? "Intră în cont" : "Creează contul"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Continuând, îți păstrezi progresul privat și asociat contului tău.
        </p>
      </section>
    </main>
  );
}
