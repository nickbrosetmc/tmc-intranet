import { Link, Redirect, useLocation } from "wouter";
import type { ReactNode } from "react";
import { useUser } from "@/lib/useUser";
import { Toaster } from "@/components/ui/sonner";

const NAV = [
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/time-clock", label: "Time Clock" },
  { href: "/admin/time-off", label: "Time Off" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/apps", label: "Apps" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/analytics", label: "Analytics" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const state = useUser();
  const [location] = useLocation();

  if (state.status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (state.status === "anonymous") {
    return <Redirect to="/" />;
  }
  if (state.user.type !== "team" || state.user.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold text-tmc-dark">
            Admins only
          </h2>
          <p className="text-sm text-muted-foreground">
            You're signed in but don't have admin access.
          </p>
          <Link
            href="/"
            className="inline-block text-sm text-tmc-gold-dark hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
      <aside className="md:w-48 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-3">
          Admin
        </h2>
        <nav className="flex md:flex-col gap-1">
          {NAV.map((n) => {
            const active = location === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-tmc-gold/20 text-tmc-dark font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-tmc-dark"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        {children}
        <Toaster />
      </div>
    </div>
  );
}
