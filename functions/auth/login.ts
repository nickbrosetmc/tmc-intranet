import {
  buildLoginUrl,
  buildStateCookie,
  generateState,
  type Env,
} from "../lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const state = generateState();
  const loginUrl = buildLoginUrl(request, env, state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl,
      "Set-Cookie": buildStateCookie(state),
    },
  });
};
