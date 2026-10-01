import { createUserManager } from "./oidc-user-manager";

// completes the popup and silent sign in flows started by the main page
void createUserManager()
  .then(async (manager) => manager.signinCallback())
  .catch((e: unknown) => {
    console.error("OIDC callback failed", e);
  });
