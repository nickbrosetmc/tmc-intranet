import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pin, PinOff } from "lucide-react";
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
import { adminAnnouncements } from "@/lib/admin-api";
import type { Announcement } from "@/lib/announcements";

export function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  async function refresh() {
    try {
      const data = await adminAnnouncements.list();
      setItems(data.announcements);
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
          Announcements
        </h1>
        <AnnouncementDialog
          mode="create"
          onSaved={refresh}
          trigger={
            <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
              New announcement
            </Button>
          }
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-6"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-6"
                >
                  No announcements yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((a) => (
                <Row key={a.id} announcement={a} onChanged={refresh} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Row({
  announcement: a,
  onChanged,
}: {
  announcement: Announcement;
  onChanged: () => void;
}) {
  async function togglePin() {
    try {
      await adminAnnouncements.update(a.id, { isPinned: !a.isPinned });
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }

  async function toggleActive() {
    try {
      await adminAnnouncements.update(a.id, { isActive: !a.isActive });
      toast.success(a.isActive ? "Archived" : "Restored");
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }

  async function remove() {
    try {
      await adminAnnouncements.remove(a.id);
      toast.success("Deleted");
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }

  const date = new Date(a.createdAt.replace(" ", "T") + "Z");

  return (
    <TableRow className={!a.isActive ? "opacity-50" : undefined}>
      <TableCell>
        <button
          type="button"
          onClick={togglePin}
          aria-label={a.isPinned ? "Unpin" : "Pin"}
          className="text-muted-foreground hover:text-tmc-gold-dark"
        >
          {a.isPinned ? (
            <Pin size={16} className="fill-tmc-gold-dark text-tmc-gold-dark" />
          ) : (
            <PinOff size={16} />
          )}
        </button>
      </TableCell>
      <TableCell className="font-medium">{a.title}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {date.toLocaleDateString()}
      </TableCell>
      <TableCell className="text-sm">
        {a.isActive ? "Active" : "Archived"}
      </TableCell>
      <TableCell className="text-right space-x-2">
        <AnnouncementDialog
          mode="edit"
          announcement={a}
          onSaved={onChanged}
          trigger={
            <Button size="sm" variant="ghost">
              Edit
            </Button>
          }
        />
        <Button size="sm" variant="ghost" onClick={toggleActive}>
          {a.isActive ? "Archive" : "Restore"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
              <AlertDialogDescription>
                This is a hard delete — can't be undone. Use Archive instead if
                you might want it back.
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

interface DialogProps {
  mode: "create" | "edit";
  announcement?: Announcement;
  onSaved: () => void;
  trigger: React.ReactNode;
}

function AnnouncementDialog({
  mode,
  announcement,
  onSaved,
  trigger,
}: DialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [isPinned, setIsPinned] = useState(announcement?.isPinned ?? false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body required");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await adminAnnouncements.create({ title, body, isPinned });
        toast.success("Announcement posted");
        setTitle("");
        setBody("");
        setIsPinned(false);
      } else {
        await adminAnnouncements.update(announcement!.id, {
          title,
          body,
          isPinned,
        });
        toast.success("Updated");
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
            {mode === "create" ? "New announcement" : "Edit announcement"}
          </DialogTitle>
          <DialogDescription>
            URLs in the body are auto-linked. Newlines are preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ConnectTeam launches Friday"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-body">Body</Label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="What's the team need to know?"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded"
            />
            Pin to top of the home page
          </label>
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
            {submitting ? "Posting…" : mode === "create" ? "Post" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
