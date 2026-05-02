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
import { adminApps, adminGroups } from "@/lib/admin-api";
import type { App, AppGroup } from "@/lib/apps";

export function AdminApps() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [groups, setGroups] = useState<AppGroup[]>([]);

  async function refresh() {
    try {
      const [a, g] = await Promise.all([adminApps.list(), adminGroups.list()]);
      setApps(a.apps);
      setGroups(g.groups);
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
          Apps
        </h1>
        <AppDialog
          mode="create"
          groups={groups}
          onSaved={refresh}
          trigger={
            <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
              Add app
            </Button>
          }
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : apps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No apps yet.
                </TableCell>
              </TableRow>
            ) : (
              apps.map((a) => (
                <AppRow key={a.id} app={a} groups={groups} onChanged={refresh} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AppRow({
  app,
  groups,
  onChanged,
}: {
  app: App;
  groups: AppGroup[];
  onChanged: () => void;
}) {
  const groupName = groups.find((g) => g.id === app.groupId)?.name ?? "—";

  async function remove() {
    try {
      await adminApps.remove(app.id);
      toast.success(`Removed ${app.name}`);
      onChanged();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <TableRow className={!app.isActive ? "opacity-50" : undefined}>
      <TableCell className="font-medium">
        <span className="mr-2">{app.iconEmoji ?? "•"}</span>
        {app.name}
      </TableCell>
      <TableCell className="text-muted-foreground">{groupName}</TableCell>
      <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-xs">
        {app.webUrl ?? app.desktopProtocol}
      </TableCell>
      <TableCell className="text-sm">
        {!app.isActive
          ? "Removed"
          : app.isComingSoon
            ? "Coming soon"
            : "Live"}
      </TableCell>
      <TableCell className="text-right space-x-2">
        <AppDialog
          mode="edit"
          app={app}
          groups={groups}
          onSaved={onChanged}
          trigger={
            <Button size="sm" variant="ghost">
              Edit
            </Button>
          }
        />
        {app.isActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive">
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {app.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  It'll disappear from the launcher. Launch history is kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
}

interface AppDialogProps {
  mode: "create" | "edit";
  app?: App;
  groups: AppGroup[];
  trigger: React.ReactNode;
  onSaved: () => void;
}

function AppDialog({ mode, app, groups, trigger, onSaved }: AppDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<App>>(
    app ?? {
      name: "",
      description: "",
      iconUrl: "",
      iconEmoji: "",
      iconBgColor: "404E5C",
      desktopProtocol: "",
      webUrl: "",
      groupId: groups[0]?.id ?? null,
      sortOrder: 0,
      isComingSoon: false,
      isActive: true,
    },
  );
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof App>(key: K, value: App[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name?.trim()) {
      toast.error("Name required");
      return;
    }
    if (!form.webUrl && !form.desktopProtocol) {
      toast.error("At least one of Web URL or Desktop Protocol is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Partial<App> = {
        ...form,
        // empty strings → null so the DB doesn't store empty
        description: form.description || null,
        iconUrl: form.iconUrl || null,
        iconEmoji: form.iconEmoji || null,
        iconBgColor: form.iconBgColor || null,
        desktopProtocol: form.desktopProtocol || null,
        webUrl: form.webUrl || null,
      };
      if (mode === "create") {
        await adminApps.create(payload);
        toast.success(`Added ${payload.name}`);
      } else {
        await adminApps.update(app!.id, payload);
        toast.success(`Updated ${payload.name}`);
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add app" : `Edit ${app?.name}`}
          </DialogTitle>
          <DialogDescription>
            Tile background color is hex without the #. Icon URL accepts any image URL — use cdn.simpleicons.org for brand logos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            <Input
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Description" className="col-span-2">
            <Input
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="Web URL" className="col-span-2">
            <Input
              placeholder="https://…"
              value={form.webUrl ?? ""}
              onChange={(e) => set("webUrl", e.target.value)}
            />
          </Field>
          <Field label="Desktop Protocol" className="col-span-2">
            <Input
              placeholder="msteams://"
              value={form.desktopProtocol ?? ""}
              onChange={(e) => set("desktopProtocol", e.target.value)}
            />
          </Field>
          <Field label="Icon URL" className="col-span-2">
            <Input
              placeholder="https://cdn.simpleicons.org/foo/ffffff"
              value={form.iconUrl ?? ""}
              onChange={(e) => set("iconUrl", e.target.value)}
            />
          </Field>
          <Field label="Emoji">
            <Input
              placeholder="🔧"
              value={form.iconEmoji ?? ""}
              onChange={(e) => set("iconEmoji", e.target.value)}
            />
          </Field>
          <Field label="BG color (hex, no #)">
            <Input
              placeholder="404E5C"
              value={form.iconBgColor ?? ""}
              onChange={(e) => set("iconBgColor", e.target.value)}
            />
          </Field>
          <Field label="Group">
            <Select
              value={form.groupId ? String(form.groupId) : "none"}
              onValueChange={(v) => set("groupId", v === "none" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sortOrder ?? 0}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
            />
          </Field>
          <Field label="Coming soon">
            <Select
              value={form.isComingSoon ? "yes" : "no"}
              onValueChange={(v) => set("isComingSoon", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === "edit" && (
            <Field label="Status">
              <Select
                value={form.isActive ? "active" : "removed"}
                onValueChange={(v) => set("isActive", v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="removed">Removed (hidden)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
