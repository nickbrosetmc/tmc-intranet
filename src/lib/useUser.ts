import { useEffect, useState } from "react";

export interface User {
  email: string;
  name: string;
  picture?: string;
}

export type UserState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User };

export function useUser(): UserState {
  const [state, setState] = useState<UserState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: "anonymous" });
          return;
        }
        if (!res.ok) throw new Error(`me endpoint returned ${res.status}`);
        const user = (await res.json()) as User;
        setState({ status: "authenticated", user });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
