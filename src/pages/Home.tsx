import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { AnnouncementsPanel } from "@/components/AnnouncementsPanel";
import { AppGrid } from "@/components/AppGrid";
import { ClientHome } from "@/components/ClientHome";
import { useUser, type TeamUser } from "@/lib/useUser";

export function HomePage() {
  const state = useUser();
  return (
    <>
      {state.status === "loading" && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading…</span>
        </div>
      )}
      {state.status === "anonymous" && (
        <div className="flex-1 flex items-center justify-center">
          <SignInPanel />
        </div>
      )}
      {state.status === "authenticated" && state.user.type === "team" && (
        <TeamWelcome user={state.user} />
      )}
      {state.status === "authenticated" && state.user.type === "client" && (
        <ClientHome user={state.user} />
      )}
      <Toaster />
    </>
  );
}

function SignInPanel() {
  return (
    <div className="w-full max-w-3xl space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-tmc-dark">
          TMC Marketing
          <span className="block text-tmc-gold">Portal</span>
        </h1>
        <p className="text-base text-muted-foreground">
          Sign in to continue.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamSignInCard />
        <ClientSignInCard />
      </div>
    </div>
  );
}

function TeamSignInCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 flex flex-col">
      <div>
        <h2 className="font-semibold text-tmc-dark">TMC Team</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sign in with your Google account.
        </p>
      </div>
      <div className="flex-1" />
      <Button
        asChild
        size="lg"
        className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark gap-3 w-full"
      >
        <a href="/auth/login">
          <GoogleIcon />
          Sign in with Google
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">
        @marketingtmc.com or invited account.
      </p>
    </div>
  );
}

function ClientSignInCard() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Username and password required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/auth/client-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Sign in failed");
        return;
      }
      window.location.href = "/";
    } catch (err) {
      toast.error(`Sign in failed: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-tmc-dark">Client Portal</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sign in with the username TMC gave you.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cl-username">Username</Label>
        <Input
          id="cl-username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cl-password">Password</Label>
        <Input
          id="cl-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="bg-tmc-slate text-white hover:bg-tmc-dark w-full"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function TeamWelcome({ user }: { user: TeamUser }) {
  return (
    <div className="w-full flex flex-col items-center gap-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-tmc-dark">
          Hey, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a tool to get started.
        </p>
      </div>
      <AnnouncementsPanel />
      <AppGrid />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.61z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.74H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.93 10.68A5.41 5.41 0 0 1 3.64 9c0-.58.1-1.15.29-1.68V4.99H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.01l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.99L3.93 7.32C4.64 5.17 6.64 3.58 9 3.58z" />
    </svg>
  );
}
