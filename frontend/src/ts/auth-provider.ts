import { envConfig } from "virtual:env-config";

import * as Firebase from "./firebase";
import * as Oidc from "./oidc";

export type AuthUser = {
  uid: string;
};

type ReadyCallback = (success: boolean, user: AuthUser | null) => Promise<void>;

/**
 * true if accounts are managed by an external OpenID Connect provider instead of firebase
 */
export function isOidcAuth(): boolean {
  return envConfig.authProvider === "oidc";
}

export async function init(callback: ReadyCallback): Promise<void> {
  if (isOidcAuth()) {
    await Oidc.init(callback);
  } else {
    await Firebase.init(callback);
  }
}

export function isAuthAvailable(): boolean {
  return isOidcAuth() ? Oidc.isAuthAvailable() : Firebase.isAuthAvailable();
}

export async function signOut(): Promise<void> {
  if (isOidcAuth()) {
    await Oidc.signOut();
  } else {
    await Firebase.signOut();
  }
}

export async function getIdToken(): Promise<string | null> {
  return isOidcAuth() ? Oidc.getIdToken() : Firebase.getIdToken();
}

export const authPromise = isOidcAuth()
  ? Oidc.authPromise
  : Firebase.authPromise;
