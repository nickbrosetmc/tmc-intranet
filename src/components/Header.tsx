import { Link } from "wouter";
import tmcLogo from "@/assets/tmc-logo.png";
import type { User } from "@/lib/useUser";

export function Header({ user }: { user: User | null }) {
  const isTeam = user?.type === "team";
  const isAdmin = isTeam && user.role === "admin";
  const subtitle = user?.type === "client" ? "CLIENT PORTAL" : "TECH HUB";

  return (
    <header className="glass-header sticky top-0 z-10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
        <img src={tmcLogo} alt="TMC Marketing" className="h-8 sm:h-9 w-auto shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-tmc-slate tracking-wide truncate">
          {subtitle}
        </span>
      </Link>
      {user ? (
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {isAdmin && (
            <Link
              href="/admin/announcements"
              className="text-xs text-tmc-slate hover:text-tmc-gold-dark font-medium uppercase tracking-wide"
            >
              Admin
            </Link>
          )}
          {isTeam && user.picture && (
            <img
              src={user.picture}
              alt=""
              className="h-8 w-8 rounded-full border border-tmc-gold/40"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="text-sm text-tmc-slate hidden md:inline">
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
        <span className="text-xs text-muted-foreground">v0.3</span>
      )}
    </header>
  );
}
