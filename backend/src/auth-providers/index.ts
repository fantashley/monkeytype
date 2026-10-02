import MonkeyError from "../utils/error";
import { firebaseAuthProvider } from "./firebase";
import { oidcAuthProvider } from "./oidc";
import { AuthProvider, AuthProviderName } from "./types";

const providers: Record<AuthProviderName, AuthProvider> = {
  firebase: firebaseAuthProvider,
  oidc: oidcAuthProvider,
};

export function getAuthProviderName(): AuthProviderName {
  const name = process.env["AUTH_PROVIDER"] ?? "firebase";
  if (name !== "firebase" && name !== "oidc") {
    throw new MonkeyError(
      500,
      `Unknown AUTH_PROVIDER "${name}", expected "firebase" or "oidc"`,
    );
  }
  return name;
}

export function getAuthProvider(): AuthProvider {
  return providers[getAuthProviderName()];
}
