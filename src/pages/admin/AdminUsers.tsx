import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminUsers, type AdminUser } from "@/lib/admin-api";

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await adminUsers.list();
      setUsers(data.users);
    } catch (e) {
      toast.error(`Failed to load users: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Users
        </h1>
        <InviteDialog onInvited={refresh} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {loading ? "Loading…" : "—"}
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <UserRow key={u.id} user={u} onChanged={refresh} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ApiTokensCard />
    </div>
  );
}

// ─── API tokens (agent / script access) ───────────────────────────────────

interface ApiTokenInfo {
  id: number;
  label: string;
  scope: "read" | "write";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  ownerEmail: string;
}

function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiTokenInfo[] | null>(null);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [minted, setMinted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/tokens", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as { tokens: ApiTokenInfo[] };
      setTokens(body.tokens);
    } catch (e) {
      toast.error(`Failed to load tokens: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function mint() {
    if (!label.trim()) {
      toast.error("Give the token a label (e.g. chief-of-staff).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), scope }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `${res.status}`);
      }
      const body = (await res.json()) as { token: string };
      setMinted(body.token);
      setLabel("");
      void refresh();
    } catch (e) {
      toast.error(`Mint failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    try {
      await fetch(`/api/admin/tokens/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      toast.success("Token revoked.");
      void refresh();
    } catch (e) {
      toast.error(`Revoke failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
          API tokens
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          For agents and scripts (e.g. a Claude assistant). Calls the same
          API as the portal with <code className="font-mono">Authorization:
          Bearer tmc_…</code>. Read scope = view only; write can update.
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="chief-of-staff"
            className="h-8 w-44 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "read" | "write")}>
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">Read-only</SelectItem>
              <SelectItem value="write">Read + write</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={mint} disabled={busy}>
          {busy ? "Minting…" : "Mint token"}
        </Button>
      </div>

      {minted && (
        <div className="rounded-md bg-tmc-dark text-tmc-gold p-3 space-y-1">
          <div className="text-[11px] uppercase tracking-widest">
            Copy this now — it won't be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs break-all flex-1">{minted}</code>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(minted);
                toast.success("Copied.");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id} className={t.revokedAt ? "opacity-50" : undefined}>
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell className="text-sm">{t.scope}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.ownerEmail}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.revokedAt
                    ? "revoked"
                    : t.lastUsedAt
                      ? new Date(t.lastUsedAt.replace(" ", "T") + "Z").toLocaleString()
                      : "never"}
                </TableCell>
                <TableCell className="text-right">
                  {!t.revokedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => revoke(t.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function UserRow({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  async function setRole(role: "user" | "admin") {
    try {
      await adminUsers.setRole(user.id, role);
      toast.success(`${user.email} is now ${role}`);
      onChanged();
    } catch (e) {
      toast.error(`Update failed: ${(e as Error).message}`);
    }
  }

  async function remove() {
    try {
      await adminUsers.remove(user.id);
      toast.success(`Removed ${user.email}`);
      onChanged();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  const lastSignIn = user.lastSignedIn
    ? new Date(user.lastSignedIn.replace(" ", "T") + "Z").toLocaleString()
    : "Never";

  return (
    <TableRow>
      <TableCell className="font-medium">{user.email}</TableCell>
      <TableCell className="text-muted-foreground">
        {user.name ?? <span className="italic">(not yet signed in)</span>}
      </TableCell>
      <TableCell>
        <Select
          value={user.role}
          onValueChange={(v) => setRole(v as "user" | "admin")}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{lastSignIn}</TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {user.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                They'll lose access immediately. Their launch history is kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await adminUsers.invite(email, role);
      toast.success(`Invited ${email}. They can sign in with Google now.`);
      setEmail("");
      setRole("user");
      setOpen(false);
      onInvited();
    } catch (e) {
      toast.error(`Invite failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They'll be able to sign in with the Google account matching this
            email. Don't forget to also add them as a Test User in Google Cloud
            Console (OAuth consent screen).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="alex@marketingtmc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!email || submitting}
            onClick={submit}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {submitting ? "Inviting…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

