import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminAnalytics, type AnalyticsSummary } from "@/lib/admin-api";

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    adminAnalytics
      .summary()
      .then(setData)
      .catch((e: Error) => toast.error(`Failed: ${e.message}`));
  }, []);

  if (!data) {
    return (
      <div className="text-muted-foreground text-sm">Loading analytics…</div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
        Analytics
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today" value={data.totalsToday} />
        <StatCard label="Last 7 days" value={data.totalsLast7Days} />
        <StatCard label="All time" value={data.totalsAllTime} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top apps</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topApps.length === 0 ? (
              <EmptyMsg />
            ) : (
              <Table>
                <TableBody>
                  {data.topApps.map((a) => (
                    <TableRow key={a.appId}>
                      <TableCell className="w-8">{a.iconEmoji}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {a.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top users</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topUsers.length === 0 ? (
              <EmptyMsg />
            ) : (
              <Table>
                <TableBody>
                  {data.topUsers.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>{u.name ?? u.email}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {u.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentLaunches.length === 0 ? (
            <EmptyMsg />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLaunches.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(l.launchedAt.replace(" ", "T") + "Z").toLocaleString()}
                    </TableCell>
                    <TableCell>{l.userEmail}</TableCell>
                    <TableCell>{l.appName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {l.launchType}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight text-tmc-dark tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">launches</div>
      </CardContent>
    </Card>
  );
}

function EmptyMsg() {
  return (
    <div className="text-sm text-muted-foreground py-2">No activity yet.</div>
  );
}
