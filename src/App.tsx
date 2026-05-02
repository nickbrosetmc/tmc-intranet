import tmcLogo from "@/assets/tmc-logo.png";
import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="glass-header sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tmcLogo} alt="TMC Marketing" className="h-9 w-auto" />
          <span className="text-sm font-medium text-tmc-slate tracking-wide">
            TECH HUB
          </span>
        </div>
        <span className="text-xs text-muted-foreground">v0.1</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center space-y-6">
          <div className="inline-block px-3 py-1 rounded-full bg-tmc-gold/15 border border-tmc-gold/40">
            <span className="text-xs font-medium tracking-wide text-tmc-slate uppercase">
              Coming Soon
            </span>
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-tmc-dark">
            TMC Marketing
            <span className="block text-tmc-gold">Tech Hub</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Your one-stop launchpad for every tool the team uses — Teams, Canva,
            GoHighLevel, Drive, ChatGPT, and more — all in one place.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              size="lg"
              className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
            >
              Sign in (coming soon)
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-tmc-gold/20 px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TMC Marketing
        </p>
      </footer>
    </div>
  );
}

export default App;
