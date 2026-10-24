// Servers can require users to sign in (users.loginRequired): signed out users
// are kept on the login page

import type { QueryClient } from "@tanstack/solid-query";
import { tryCatch } from "@monkeytype/util/trycatch";

import { getServerConfigurationQueryOptions } from "../queries/server-configuration";
import { getLastKnownLoginRequired } from "../states/login-required";
import type { RouterAuth } from "./create-router-auth";

/**
 * true if the server only lets signed in users use the site.
 * The last known setting is used so pages show straight away; the
 * configuration is only waited for if this browser never loaded it. If it
 * can't be loaded then, signed out users stay on the login page, which shows
 * that the server is unavailable.
 */
export async function isLoginRequired(
  queryClient: QueryClient,
): Promise<boolean> {
  const lastKnown = getLastKnownLoginRequired();
  if (lastKnown !== null) return lastKnown;

  const options = getServerConfigurationQueryOptions();
  const state = queryClient.getQueryState(options.queryKey);
  if (state?.data !== undefined) return state.data.users.loginRequired;
  // don't wait for it again on every page change once it failed to load, also
  // while it's retried (eg. by the login page)
  if (state !== undefined && state.errorUpdateCount > 0) return true;

  const { data } = await tryCatch(queryClient.fetchQuery(options));
  return data?.users.loginRequired ?? true;
}

/**
 * isLoginRequired without waiting, for checks that can't: until the setting
 * is known, login is assumed to be required
 */
export function isLoginRequiredNow(queryClient: QueryClient): boolean {
  return (
    getLastKnownLoginRequired() ??
    queryClient.getQueryData(getServerConfigurationQueryOptions().queryKey)
      ?.users.loginRequired ??
    true
  );
}

/**
 * true if the user has to sign in before they can use the site
 */
export async function mustSignIn(context: {
  auth: RouterAuth;
  queryClient: QueryClient;
}): Promise<boolean> {
  return (
    !context.auth.isSignedIn() && (await isLoginRequired(context.queryClient))
  );
}
