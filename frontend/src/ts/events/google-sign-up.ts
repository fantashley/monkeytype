import { UserCredential } from "firebase/auth";
import type { AuthUser } from "../types/auth";
import { createEvent } from "../hooks/createEvent";

export type GoogleSignUpEventData =
  | {
      signedInUser: UserCredential;
      isNewUser: boolean;
    }
  | {
      /** user signed in at an OIDC provider without an account */
      oidcUser: AuthUser;
    };

export const googleSignUpEvent = createEvent<GoogleSignUpEventData>();
