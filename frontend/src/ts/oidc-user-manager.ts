import type { UserManager } from "oidc-client-ts";
import { envConfig } from "virtual:env-config";

/**
 * page that completes the popup (reauthentication) and silent (token renewal) flows.
 * It has to be registered as a redirect uri at the identity provider, together with /login
 */
export const OIDC_CALLBACK_PATH = "/oidc-callback.html";

export async function createUserManager(): Promise<UserManager> {
  const { UserManager, WebStorageStateStore } = await import("oidc-client-ts");
  const origin = window.location.origin;
  return new UserManager({
    authority: envConfig.oidc.authority,
    client_id: envConfig.oidc.clientId,
    scope: envConfig.oidc.scope,
    redirect_uri: `${origin}/login`,
    popup_redirect_uri: `${origin}${OIDC_CALLBACK_PATH}`,
    silent_redirect_uri: `${origin}${OIDC_CALLBACK_PATH}`,
    post_logout_redirect_uri: origin,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
  });
}
