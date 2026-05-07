import { FolderOpen, KeyRound, MessageSquare, Zap } from "lucide-react";
import type { ClientUser } from "@/lib/useUser";

const FALLBACK_GHL_URL = "https://app.tmctechhub.com";

export function ClientHome({ user }: { user: ClientUser }) {
  const client = user.client;
  if (!client) {
    return (
      <div className="text-center max-w-md space-y-3 mx-auto">
        <h1 className="text-xl font-semibold text-tmc-dark">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your client account isn't fully set up yet. Reach out to TMC and we'll get
          your tools wired up.
        </p>
      </div>
    );
  }

  const tiles: Tile[] = [
    {
      label: "Files",
      description: "Your shared drive with TMC",
      url: client.filesUrl,
      icon: <FolderOpen size={32} strokeWidth={1.75} />,
      bg: "bg-tmc-slate",
      placeholder: "TMC will share your folder link here once it's set up.",
    },
    {
      label: "GoHighLevel",
      description: "Your CRM dashboard",
      url: client.ghlUrl ?? FALLBACK_GHL_URL,
      icon: <Zap size={32} strokeWidth={1.75} />,
      bg: "bg-[#FF7F32]",
      placeholder: null,
    },
    {
      label: "Password Vault",
      description: "Shared credentials in 1Password",
      url: client.passwordVaultUrl,
      icon: <KeyRound size={32} strokeWidth={1.75} />,
      bg: "bg-[#0572EC]",
      placeholder: "TMC will share a 1Password vault link here once it's set up.",
    },
    {
      label: "Submit a Ticket",
      description: "Coming soon",
      url: null,
      icon: <MessageSquare size={32} strokeWidth={1.75} />,
      bg: "bg-tmc-gold-dark",
      placeholder: "Ticket system launching in the next update.",
    },
  ];

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-tmc-dark">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {client.name}'s client portal — everything TMC has set up for you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {tiles.map((t) => (
          <TileCard key={t.label} tile={t} />
        ))}
      </div>
    </div>
  );
}

interface Tile {
  label: string;
  description: string;
  url: string | null;
  icon: React.ReactNode;
  bg: string;
  placeholder: string | null;
}

function TileCard({ tile }: { tile: Tile }) {
  const content = (
    <>
      <div
        className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${tile.bg} ${tile.url ? "" : "opacity-50"}`}
      >
        {tile.icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-tmc-dark">{tile.label}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {tile.url ? tile.description : (tile.placeholder ?? tile.description)}
        </p>
      </div>
    </>
  );

  const baseClass =
    "flex items-center gap-4 rounded-lg border bg-card p-5 transition-shadow";

  if (!tile.url) {
    return (
      <div className={`${baseClass} opacity-70 cursor-not-allowed`}>{content}</div>
    );
  }
  return (
    <a
      href={tile.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} hover:shadow-md`}
    >
      {content}
    </a>
  );
}
