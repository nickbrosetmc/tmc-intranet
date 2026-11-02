// DELETE /api/admin/finance/clients/:id/rate-changes/:changeId: rate history
// is corrected in TMC Finance now, which writes it here.

import { isResponse, requireAdmin } from "../../../../../../lib/admin";
import type { Env } from "../../../../../../lib/auth";
import { editedInFinance } from "../../../../../../lib/financeApp";

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return editedInFinance("Rate history is corrected");
};
