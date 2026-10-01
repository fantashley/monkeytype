import { UserCredential } from "firebase/auth";
import type { AuthUser } from "../auth-provider";
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
