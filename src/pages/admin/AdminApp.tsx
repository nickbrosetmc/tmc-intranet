// The admin side of the portal, as its own part of the program: a dark
// sidebar shell in place of the team header and nav, an Overview landing
// page, and Finance split into pages of its own. App hands every /admin path
// here.

import type { ComponentType, ReactNode } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  KeyRound,
  CalendarOff,
  ChartColumn,
  ChartLine,
  Clock,
  FolderTree,
  Gauge,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Menu,
  Package,
  PiggyBank,
  Receipt,
  Rocket,
  UserCog,
  Wallet,
} from "lucide-react";
import tmcLogo from "@/assets/tmc-logo.png";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser, type TeamUser } from "@/lib/useUser";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminAnnouncements } from "@/pages/admin/AdminAnnouncements";
import { AdminClients } from "@/pages/admin/AdminClients";
import { AdminClientsRoster } from "@/pages/admin/AdminClientsRoster";
import { AdminClientProfile } from "@/pages/admin/AdminClientProfile";
import { AdminProjects } from "@/pages/admin/AdminProjects";
import { AdminTimeClock } from "@/pages/admin/AdminTimeClock";
import { AdminTimeOff } from "@/pages/admin/AdminTimeOff";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminApps } from "@/pages/admin/AdminApps";
import { AdminGroups } from "@/pages/admin/AdminGroups";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import {
  FinanceBudgetsPage,
  FinanceCashflowPage,
  FinanceDashboardPage,
  FinanceExpensesPage,
  FinanceLifetimePage,
  FinancePlanningPage,
  FinanceProvider,
  FinanceRevenuePage,
} from "@/pages/admin/AdminFinance";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Match only this exact path, not the pages beneath it. */
  exact?: boolean;
}

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true }] },
  {
    title: "Finance",
    items: [
      { href: "/admin/finance", label: "Dashboard", icon: Gauge, exact: true },
      { href: "/admin/finance/cash-flow", label: "Cash flow", icon: ChartLine },
      { href: "/admin/finance/revenue", label: "Revenue", icon: Wallet },
      { href: "/admin/finance/clients", label: "Client lifetime", icon: Hourglass },
      { href: "/admin/finance/expenses", label: "Expenses", icon: Receipt },
      { href: "/admin/finance/planning", label: "Planning & gear", icon: Package },
      { href: "/admin/finance/budgets", label: "Budgets", icon: PiggyBank },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/admin/time-clock", label: "Time clock", icon: Clock },
      { href: "/admin/time-off", label: "Time off", icon: CalendarOff },
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    title: "Clients",
    items: [
      { href: "/admin/clients", label: "All clients", icon: Building2 },
      { href: "/admin/projects", label: "Projects", icon: Rocket },
      { href: "/admin/portal-accounts", label: "Portal accounts", icon: KeyRound },
    ],
  },
  {
    title: "Portal",
    items: [
      { href: "/admin/apps", label: "Apps", icon: LayoutGrid },
      { href: "/admin/groups", label: "Groups", icon: FolderTree },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumn },
    ],
  },
];

function isActive(location: string, item: NavItem): boolean {
  if (item.exact) return location === item.href;
  return location === item.href || location.startsWith(item.href + "/");
}

export function AdminApp() {
  const state = useUser();

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (state.status === "anonymous") return <Redirect to="/" />;
  if (state.user.type !== "team" || state.user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold text-tmc-dark">Admins only</h2>
          <p className="text-sm text-muted-foreground">
            You're signed in but don't have admin access.
          </p>
          <Link href="/" className="inline-block text-sm text-tmc-gold-dark hover:underline">
            ← Back to the Tech Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell user={state.user}>
      <Switch>
        <Route path="/admin" component={AdminOverview} />
        {/* One provider for every Finance page, so moving between them keeps
            the loaded data and the chosen month. */}
        <Route path="/admin/finance" nest>
          <FinanceProvider>
            <Switch>
              <Route path="/" component={FinanceDashboardPage} />
              <Route path="/cash-flow" component={FinanceCashflowPage} />
              <Route path="/revenue" component={FinanceRevenuePage} />
              <Route path="/clients" component={FinanceLifetimePage} />
              <Route path="/expenses" component={FinanceExpensesPage} />
              <Route path="/planning" component={FinancePlanningPage} />
              <Route path="/budgets" component={FinanceBudgetsPage} />
              <Route>
                <NotFound />
              </Route>
            </Switch>
          </FinanceProvider>
        </Route>
        <Route path="/admin/announcements" component={AdminAnnouncements} />
        <Route path="/admin/clients" component={AdminClientsRoster} />
        <Route path="/admin/clients/:id" component={AdminClientProfile} />
        <Route path="/admin/projects" component={AdminProjects} />
        <Route path="/admin/portal-accounts" component={AdminClients} />
        <Route path="/admin/time-clock" component={AdminTimeClock} />
        <Route path="/admin/time-off" component={AdminTimeOff} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/apps" component={AdminApps} />
        <Route path="/admin/groups" component={AdminGroups} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </AdminShell>
  );
}

function AdminShell({ user, children }: { user: TeamUser; children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="admin-sidebar hidden md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:h-screen">
        <Link href="/admin" className="flex items-center gap-3 px-5 pt-5 pb-4">
          <img src={tmcLogo} alt="TMC Marketing" className="h-9 w-auto shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tmc-gold">
            Admin
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-3" aria-label="Admin">
          {NAV.map((section, i) => (
            <div key={section.title ?? i} className="space-y-0.5">
              {section.title && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const active = isActive(location, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-[5px] text-sm transition-colors ${
                      active
                        ? "bg-white/10 text-white font-medium shadow-[inset_2px_0_0_#CFB583]"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={16} className={active ? "text-tmc-gold" : "text-white/45"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={16} className="text-white/45" />
            Back to the Tech Hub
          </Link>
          <div className="flex items-center gap-2.5 px-3 pt-2">
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                className="h-7 w-7 rounded-full border border-tmc-gold/40"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="h-7 w-7 rounded-full bg-white/10 text-white/80 text-xs flex items-center justify-center">
                {user.name.slice(0, 1)}
              </span>
            )}
            <span className="flex-1 min-w-0 truncate text-sm text-white/80">{user.name}</span>
            <a href="/auth/logout" className="text-xs text-white/45 hover:text-white">
              Sign out
            </a>
          </div>
        </div>
      </aside>

      {/* Phone and tablet: a top bar with the same sections in a menu */}
      <MobileBar location={location} />

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
        <Toaster />
      </main>
    </div>
  );
}

function MobileBar({ location }: { location: string }) {
  const current = NAV.flatMap((s) => s.items).find((i) => isActive(location, i));
  return (
    <div className="admin-sidebar md:hidden sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3">
      <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
        <img src={tmcLogo} alt="TMC Marketing" className="h-8 w-auto shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tmc-gold">
          Admin
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white">
          <Menu size={16} />
          {current?.label ?? "Menu"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
          {NAV.map((section, i) => (
            <div key={section.title ?? i}>
              {i > 0 && <DropdownMenuSeparator />}
              {section.title && <DropdownMenuLabel>{section.title}</DropdownMenuLabel>}
              {section.items.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon size={14} />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft size={14} />
              Back to the Tech Hub
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      Page not found.{" "}
      <Link href="~/admin" className="text-tmc-gold-dark hover:underline">
        Go to the admin overview
      </Link>
    </div>
  );
}
