import tmcLogo from "@/assets/tmc-logo.png";
import { Button } from "@/components/ui/button";
import { useUser, type User } from "@/lib/useUser";

function App() {
  const state = useUser();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={state.status === "authenticated" ? state.user : null} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {state.status === "loading" && <LoadingState />}
        {state.status === "anonymous" && <SignInState />}
        {state.status === "authenticated" && <WelcomeState user={state.user} />}
      </main>

      <footer className="border-t border-tmc-gold/20 px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TMC Marketing
        </p>
      </footer>
    </div>
  );
}

function Header({ user }: { user: User | null }) {
  return (
    <header className="glass-header sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={tmcLogo} alt="TMC Marketing" className="h-9 w-auto" />
        <span className="text-sm font-medium text-tmc-slate tracking-wide">
          TECH HUB
        </span>
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          {user.picture && (
            <img
              src={user.picture}
              alt=""
              className="h-8 w-8 rounded-full border border-tmc-gold/40"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="text-sm text-tmc-slate hidden sm:inline">
            {user.name}
          </span>
          <a
            href="/auth/logout"
            className="text-xs text-muted-foreground hover:text-tmc-slate"
          >
            Sign out
          </a>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">v0.1</span>
      )}
    </header>
  );
}

function LoadingState() {
  return (
    <div className="text-muted-foreground text-sm">Loading…</div>
  );
}

function SignInState() {
  return (
    <div className="max-w-md text-center space-y-6">
      <h1 className="text-4xl font-semibold tracking-tight text-tmc-dark">
        TMC Marketing
        <span className="block text-tmc-gold">Tech Hub</span>
      </h1>
      <p className="text-base text-muted-foreground">
        One launchpad for every tool the team uses.
      </p>
      <div className="pt-2">
        <Button asChild size="lg" className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark gap-3">
          <a href="/auth/login">
            <GoogleIcon />
            Sign in with Google
          </a>
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          TMC team only. Ask Nick if you need access.
        </p>
      </div>
    </div>
  );
}

function WelcomeState({ user }: { user: User }) {
  return (
    <div className="max-w-2xl text-center space-y-6">
      <div className="inline-block px-3 py-1 rounded-full bg-tmc-gold/15 border border-tmc-gold/40">
        <span className="text-xs font-medium tracking-wide text-tmc-slate uppercase">
          App Grid Coming Next
        </span>
      </div>
      <h1 className="text-5xl font-semibold tracking-tight text-tmc-dark">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="text-lg text-muted-foreground">
        Your tools will appear here in a moment.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.74H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.93 10.68A5.41 5.41 0 0 1 3.64 9c0-.58.1-1.15.29-1.68V4.99H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.01l2.97-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.99L3.93 7.32C4.64 5.17 6.64 3.58 9 3.58z"
      />
    </svg>
  );
}

export default App;
