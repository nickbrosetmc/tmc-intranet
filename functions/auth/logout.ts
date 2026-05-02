import { clearSessionCookie } from "../lib/auth";

export const onRequest: PagesFunction = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": clearSessionCookie(),
    },
  });
};
