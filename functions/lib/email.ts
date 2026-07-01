// Thin Resend wrapper. Sends transactional email via the REST API (no SDK
// needed on Workers). Degrades gracefully: if RESEND_API_KEY isn't set we
// log and return false instead of throwing, so a submission still saves
// even before Resend is wired up.
//
// Secrets / vars (set in the Cloudflare Pages dashboard):
//   RESEND_API_KEY  (secret)  — from resend.com
//   RESEND_FROM     (var)     — a from-address on your Resend-verified
//                               domain, e.g. "TMC Portal <portal@marketingtmc.com>"

export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

const DEFAULT_FROM = "TMC Portal <portal@marketingtmc.com>";

export async function sendEmail(
  env: EmailEnv,
  msg: { to: string[]; subject: string; html: string; replyTo?: string },
): Promise<boolean> {
  const to = msg.to.map((t) => t.trim()).filter(Boolean);
  if (to.length === 0) return false;
  if (!env.RESEND_API_KEY) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "email.skipped_no_key",
        subject: msg.subject,
        to,
      }),
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || DEFAULT_FROM,
        to,
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(
        JSON.stringify({
          level: "error",
          msg: "email.send_failed",
          status: res.status,
          body: body.slice(0, 500),
        }),
      );
      return false;
    }
    return true;
  } catch (e) {
    console.log(
      JSON.stringify({ level: "error", msg: "email.exception", error: String(e) }),
    );
    return false;
  }
}

/** Minimal HTML escaping for interpolating user content into an email. */
export function esc(s: string): string {
  return s.replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!,
  );
}
