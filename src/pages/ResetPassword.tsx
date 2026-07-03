import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

// Public page reached from the reset-link email:
// /reset-password?token=<64-hex>. Posts the token + new password; the
// server burns the token on success.
export function ResetPasswordPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const tokenLooksValid = /^[0-9a-f]{64}$/.test(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `${res.status}`);
      }
      setDone(true);
    } catch (e2) {
      toast.error(`${(e2 as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Choose a new password
        </h1>
      </div>

      {done ? (
        <div className="rounded-lg border bg-card p-6 text-center space-y-4">
          <p className="text-sm text-tmc-dark">
            Your password is updated. Sign in with it now.
          </p>
          <Button
            asChild
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark w-full"
          >
            <a href="/">Go to sign in</a>
          </Button>
        </div>
      ) : !tokenLooksValid ? (
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-tmc-dark">
            This reset link is invalid or incomplete.
          </p>
          <p className="text-xs text-muted-foreground">
            Head back to the sign-in page and use "Forgot password?" to get a
            fresh link.
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href="/">Back to sign in</a>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="min 8 characters"
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {busy ? "Saving…" : "Set new password"}
          </Button>
        </form>
      )}

      <Toaster />
    </div>
  );
}
