import { Clock } from "lucide-react";
import { useUser } from "@/lib/useUser";

export function TimeClockPage() {
  const userState = useUser();
  const isTeam = userState.status === "authenticated" && userState.user.type === "team";

  return (
    <div className="w-full max-w-4xl space-y-4">
      <header className="border-b border-tmc-gold/40 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Time Clock
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your hours this week from Connecteam.
        </p>
      </header>

      {!isTeam ? (
        <div className="text-sm text-muted-foreground">
          Sign in as a team member to see your hours.
        </div>
      ) : (
        <ComingSoon />
      )}
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="rounded-lg border bg-card p-12 text-center space-y-3">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-tmc-gold/20 items-center justify-center">
        <Clock size={28} className="text-tmc-gold-dark" />
      </div>
      <h2 className="text-lg font-semibold text-tmc-dark">Coming soon</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Connecteam time clock integration is being wired up. Once it's live,
        you'll see your hours this week, recent shifts, and clock-in status
        right here.
      </p>
    </div>
  );
}
