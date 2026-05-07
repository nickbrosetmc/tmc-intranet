import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  adminClients,
  type AdminClient,
  type AdminClientUser,
} from "@/lib/admin-api";

export function AdminClients() {
  const [clients, setClients] = useState<AdminClient[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function refresh() {
    try {
      const data = await adminClients.list();
      setClients(data.clients);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Clients
        </h1>
        <ClientDialog mode="create" onSaved={refresh} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Files URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients === null ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No clients yet. Click "Set up new client" to get started.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <ClientRowGroup
                  key={c.id}
                  client={c}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onChanged={refresh}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ClientRowGroup({
  client,
  expanded,
  onToggle,
  onChanged,
}: {
  client: AdminClient;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  async function remove() {
    try {
      await adminClients.remove(client.id);
      toast.success(`Removed ${client.name}`);
      onChanged();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <TableRow className={!client.isActive ? "opacity-50" : undefined}>
        <TableCell>
          <button
            onClick={onToggle}
            className="font-medium hover:text-tmc-gold-dark"
          >
            {expanded ? "▾" : "▸"} {client.name}
          </button>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-xs">
          {client.filesUrl ?? <span className="italic">— not set —</span>}
        </TableCell>
        <TableCell className="text-sm">
          {client.isActive ? "Active" : "Inactive"}
        </TableCell>
        <TableCell className="text-right space-x-2">
          <ClientDialog mode="edit" client={client} onSaved={onChanged} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  All client users for this client will lose access immediately.
                  This is a hard delete and can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/40">
            <ClientUsersPanel clientId={client.id} clientName={client.name} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ClientUsersPanel({
  clientId,
  clientName,
}: {
  clientId: number;
  clientName: string;
}) {
  const [users, setUsers] = useState<AdminClientUser[] | null>(null);

  async function refresh() {
    try {
      const data = await adminClients.listUsers(clientId);
      setUsers(data.users);
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, [clientId]);

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-tmc-dark">
          Users at {clientName}
        </h3>
        <ClientUserDialog mode="create" clientId={clientId} onSaved={refresh} />
      </div>
      {users === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No users yet. Add one so they can sign in.
        </p>
      ) : (
        <div className="rounded-md bg-card border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <ClientUserRow key={u.id} user={u} onChanged={refresh} clientId={clientId} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClientUserRow({
  user,
  clientId,
  onChanged,
}: {
  user: AdminClientUser;
  clientId: number;
  onChanged: () => void;
}) {
  async function remove() {
    try {
      await adminClients.removeUser(user.id);
      toast.success(`Removed ${user.name}`);
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
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="text-sm font-mono">{user.username}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{lastSignIn}</TableCell>
      <TableCell className="text-right space-x-2">
        <ClientUserDialog
          mode="edit"
          clientId={clientId}
          user={user}
          onSaved={onChanged}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They'll lose access to the client portal immediately.
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

// ─── Client dialog (create / edit) ────────────────────────────────────────

interface ClientDialogProps {
  mode: "create" | "edit";
  client?: AdminClient;
  onSaved: () => void;
}

function ClientDialog({ mode, client, onSaved }: ClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    filesUrl: client?.filesUrl ?? "",
    ghlUrl: client?.ghlUrl ?? "",
    passwordVaultUrl: client?.passwordVaultUrl ?? "",
    isActive: client?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        filesUrl: form.filesUrl || null,
        ghlUrl: form.ghlUrl || null,
        passwordVaultUrl: form.passwordVaultUrl || null,
      };
      if (mode === "create") {
        await adminClients.create(payload);
        toast.success(`Added ${form.name}`);
      } else {
        await adminClients.update(client!.id, { ...payload, isActive: form.isActive });
        toast.success(`Updated ${form.name}`);
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
            Set up new client
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Set up new client" : `Edit ${client?.name}`}
          </DialogTitle>
          <DialogDescription>
            All URL fields are optional — fill in what you have, leave the rest blank
            and the tile will show as not-yet-configured for the client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Inc"
            />
          </div>
          <div className="space-y-2">
            <Label>Files URL (UGREEN/NAS share link)</Label>
            <Input
              placeholder="https://ug.link/…"
              value={form.filesUrl}
              onChange={(e) => setForm({ ...form, filesUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>GHL URL</Label>
            <Input
              placeholder="https://app.tmctechhub.com"
              value={form.ghlUrl}
              onChange={(e) => setForm({ ...form, ghlUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to default to https://app.tmctechhub.com
            </p>
          </div>
          <div className="space-y-2">
            <Label>1Password vault URL</Label>
            <Input
              placeholder="https://my.1password.com/vaults/…"
              value={form.passwordVaultUrl}
              onChange={(e) =>
                setForm({ ...form, passwordVaultUrl: e.target.value })
              }
            />
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client user dialog ───────────────────────────────────────────────────

interface ClientUserDialogProps {
  mode: "create" | "edit";
  clientId: number;
  user?: AdminClientUser;
  onSaved: () => void;
}

function ClientUserDialog({ mode, clientId, user, onSaved }: ClientUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    if (mode === "create" && !form.username.trim()) {
      toast.error("Username required");
      return;
    }
    if (mode === "create" && form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (mode === "edit" && form.password && form.password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await adminClients.createUser(clientId, {
          username: form.username,
          password: form.password,
          name: form.name,
        });
        toast.success(`Added ${form.name}`);
      } else {
        const updates: { name?: string; password?: string } = {};
        if (form.name !== user!.name) updates.name = form.name;
        if (form.password) updates.password = form.password;
        if (Object.keys(updates).length === 0) {
          toast.info("No changes to save");
          setSubmitting(false);
          return;
        }
        await adminClients.updateUser(user!.id, updates);
        toast.success(`Updated ${form.name}`);
      }
      setOpen(false);
      setForm({ name: user?.name ?? "", username: user?.username ?? "", password: "" });
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="bg-tmc-slate text-white hover:bg-tmc-dark">
            Add user
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add client user" : `Edit ${user?.name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Pick a username (any string — doesn't need to be an email) and an initial password (min 8 chars). Share both with the client."
              : "Leave password blank to keep it unchanged. Set a value to reset it (min 8 chars). Username can't be changed."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Kevin Duffy"
            />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value.toLowerCase() })
              }
              placeholder="kevin.duffy"
              disabled={mode === "edit"}
            />
          </div>
          <div className="space-y-2">
            <Label>{mode === "create" ? "Password" : "New password (optional)"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={mode === "create" ? "min 8 characters" : "leave blank to keep"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
