// A link to TMC Finance where the hub used to edit a client: clients, what
// they pay and their contracts are edited there now, and show here.

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINANCE_APP_URL } from "@/lib/financeApp";

export function EditInFinance({
  label = "Edit in TMC Finance",
  path = "/clients",
  compact = false,
}: {
  label?: string;
  path?: string;
  /** A plain text link, for a table row. */
  compact?: boolean;
}) {
  const href = `${FINANCE_APP_URL}${path}`;
  if (compact) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-tmc-gold-dark hover:underline">
        {label} <ExternalLink size={11} aria-hidden />
      </a>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noreferrer">
        {label} <ExternalLink size={13} aria-hidden />
      </a>
    </Button>
  );
}
