// POST /api/admin/finance/clients/:id/rate-changes: rate changes are recorded
// in TMC Finance now, which writes them here (/api/finance-feed/rate-changes).

import { isResponse, requireAdmin } from "../../../../../../lib/admin";
import type { Env } from "../../../../../../lib/auth";
import { editedInFinance } from "../../../../../../lib/financeApp";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return editedInFinance("Rate changes are recorded");
};
