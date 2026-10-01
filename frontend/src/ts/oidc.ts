import type { User, UserManager } from "oidc-client-ts";
import { envConfig } from "virtual:env-config";

import { setUserId, setUserVerified } from "./states/core";
import { promiseWithResolvers } from "./utils/misc";
import type { AuthUser } from "./auth-provider";
import { createUserManager } from "./oidc-user-manager";

type ReadyCallback = (success: boolean, user: AuthUser | null) => Promise<void>;

// renew the id token if it expires within this time
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

let manager: UserManager | undefined;
let readyCallback: ReadyCallback | undefined;
let renewPromise: Promise<User | null> | undefined;

const { promise: authPromise, resolve: resolveAuthPromise } =
  promiseWithResolvers();

function isRedirectCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.pathname === "/login" &&
    params.has("state") &&
    (params.has("code") || params.has("error"))
  );
}

function toAuthUser(user: User | null): AuthUser | null {
  if (user === null || user.expired === true) return null;
  return { uid: user.profile.sub };
}

function setUserState(user: AuthUser | null): void {
  setUserId(user?.uid ?? null);
  // email verification is handled by the identity provider
  setUserVerified(user !== null);
}

export async function init(callback: ReadyCallback): Promise<void> {
  try {
    if (envConfig.oidc.authority === "" || envConfig.oidc.clientId === "") {
      throw new Error("OIDC authority or client id missing");
    }
    manager = await createUserManager();
    readyCallback = callback;

    if (isRedirectCallback()) {
      try {
        await manager.signinRedirectCallback();
      } catch (e) {
        console.error("OIDC sign in failed", e);
      }
      window.history.replaceState(null, "", "/login");
    }

    manager.events.addUserSignedOut(async () => {
      await clearUser();
    });

    let user = await manager.getUser();
    if (user?.expired === true) {
      user = await renewToken();
      if (user === null) await manager.removeUser();
    }

    const authUser = toAuthUser(user);
    setUserState(authUser);
    await callback(true, authUser);
  } catch (e) {
    manager = undefined;
    console.error("OIDC failed to initialize", e);
    await callback(false, null);
    setUserState(null);
  } finally {
    resolveAuthPromise();
  }
}

export function isAuthAvailable(): boolean {
  return manager !== undefined;
}

/**
 * redirects to the identity provider.
 * Always asks the user to authenticate again, tokens revoked by the backend
 * are rejected based on the time of the last authentication.
 */
export async function signIn(): Promise<void> {
  if (manager === undefined) throw new Error("Authentication uninitialized");
  await manager.signinRedirect({ prompt: "login" });
}

async function clearUser(): Promise<void> {
  await manager?.removeUser();
  setUserState(null);
  await readyCallback?.(true, null);
}

export async function signOut(): Promise<void> {
  console.log("auth signout");
  await clearUser();
}

async function renewToken(): Promise<User | null> {
  if (manager === undefined) return null;
  renewPromise ??= manager
    .signinSilent()
    .catch((e: unknown) => {
      console.error("Failed to renew OIDC token", e);
      return null;
    })
    .finally(() => {
      renewPromise = undefined;
    });
  return renewPromise;
}

export async function getIdToken(): Promise<string | null> {
  if (manager === undefined) return null;
  let user = await manager.getUser();
  if (user === null) return null;

  const expiresAt = user.profile.exp;
  if (expiresAt - TOKEN_EXPIRY_BUFFER_SECONDS < Date.now() / 1000) {
    user = await renewToken();
    if (user === null) {
      await clearUser();
      return null;
    }
  }

  return user.id_token ?? null;
}

/**
 * Sign in again in a popup to get a fresh token, required by sensitive endpoints.
 */
export async function reauthenticate(): Promise<void> {
  if (manager === undefined) throw new Error("Authentication uninitialized");
  const currentUser = await manager.getUser();

  const user = await manager.signinPopup({ prompt: "login", max_age: 0 });

  if (currentUser !== null && user.profile.sub !== currentUser.profile.sub) {
    await manager.storeUser(currentUser);
    throw new Error("Signed in with a different account");
  }
}

export { authPromise };
