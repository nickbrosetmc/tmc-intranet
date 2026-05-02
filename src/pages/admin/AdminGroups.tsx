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
import { adminGroups } from "@/lib/admin-api";
import type { AppGroup } from "@/lib/apps";

export function AdminGroups() {
  const [groups, setGroups] = useState<AppGroup[] | null>(null);

  async function refresh() {
    try {
      const data = await adminGroups.list();
      setGroups(data.groups);
    } catch (e) {
      toast.error(`Failed to load groups: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Groups
        </h1>
        <GroupDialog mode="create" onSaved={refresh} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sort order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups === null ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  No groups yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <GroupRow key={g.id} group={g} onChanged={refresh} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GroupRow({
  group,
  onChanged,
}: {
  group: AppGroup;
  onChanged: () => void;
}) {
  async function remove() {
    try {
      await adminGroups.remove(group.id);
      toast.success(`Removed ${group.name}`);
      onChanged();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{group.name}</TableCell>
      <TableCell className="text-muted-foreground">{group.sortOrder}</TableCell>
      <TableCell className="text-right space-x-2">
        <GroupDialog mode="edit" group={group} onSaved={onChanged} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Apps in this group will be moved to "No group" but kept.
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
  );
}

interface GroupDialogProps {
  mode: "create" | "edit";
  group?: AppGroup;
  onSaved: () => void;
}

function GroupDialog({ mode, group, onSaved }: GroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group?.name ?? "");
  const [sortOrder, setSortOrder] = useState(group?.sortOrder ?? 0);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await adminGroups.create(name.trim(), sortOrder);
        toast.success(`Added ${name}`);
        setName("");
        setSortOrder(0);
      } else {
        await adminGroups.update(group!.id, { name: name.trim(), sortOrder });
        toast.success(`Updated ${name}`);
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
            Add group
          </Button>
        ) : (
          <Button size="sm" variant="ghost">
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New group" : `Edit ${group?.name}`}
          </DialogTitle>
          <DialogDescription>
            Groups are the section headers on the home grid. Lower sort order = higher on the page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="grp-name">Name</Label>
            <Input
              id="grp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grp-sort">Sort order</Label>
            <Input
              id="grp-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </div>
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
