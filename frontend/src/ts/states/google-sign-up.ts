import { UserCredential } from "firebase/auth";
import { createSignal } from "solid-js";
import type { AuthUser } from "../types/auth";
import { showModal } from "./modals";

/** The new google user picking a name in the google sign up modal. */
const [getGoogleSignUpUser, setGoogleSignUpUser] = createSignal<
  UserCredential | undefined
>(undefined);

export { getGoogleSignUpUser, setGoogleSignUpUser };

export function showGoogleSignUpModal(user: UserCredential): void {
  setGoogleSignUpUser(user);
  showModal("GoogleSignup");
}

/** The user signed in at an OIDC provider without an account, picking a name. */
const [getOidcSignUpUser, setOidcSignUpUser] = createSignal<
  AuthUser | undefined
>(undefined);

export { getOidcSignUpUser, setOidcSignUpUser };

export function showOidcSignUpModal(user: AuthUser): void {
  setOidcSignUpUser(user);
  showModal("GoogleSignup");
}
