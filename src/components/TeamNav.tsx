import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/useUser";

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/content", label: "Content" },
  { href: "/time-clock", label: "Time Clock" },
  { href: "/time-off", label: "Time Off" },
  { href: "/calculator", label: "Package Calc" },
  { href: "/video-calculator", label: "Video Calc" },
];

/**
 * Primary nav for team users. Hidden for anonymous + client users.
 * Renders inline pills on desktop, hamburger dropdown on mobile.
 */
export function TeamNav({ user }: { user: User | null }) {
  if (!user || user.type !== "team") return null;
  return (
    <nav className="border-b bg-card/60">
      <div className="px-3 sm:px-6 py-2 max-w-7xl mx-auto">
        <DesktopNav />
        <MobileNav />
      </div>
    </nav>
  );
}

function DesktopNav() {
  const [location] = useLocation();
  return (
    <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
      {NAV.map((item) => {
        const active = isActive(location, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? "bg-tmc-gold/25 text-tmc-dark"
                : "text-muted-foreground hover:text-tmc-dark hover:bg-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function MobileNav() {
  const [location] = useLocation();
  const activeItem = NAV.find((i) => isActive(location, i.href));
  return (
    <div className="sm:hidden flex items-center justify-between">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Menu size={16} />
            <span className="font-medium">
              {activeItem?.label ?? "Menu"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {NAV.map((item) => {
            const active = isActive(location, item.href);
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={`w-full ${active ? "bg-muted font-semibold" : ""}`}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function isActive(location: string, href: string): boolean {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(href + "/");
}
