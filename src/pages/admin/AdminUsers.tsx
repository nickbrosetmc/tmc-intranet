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

