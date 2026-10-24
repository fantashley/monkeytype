import { z } from "zod";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";

// last known users.loginRequired setting of the server, used until the
// configuration is loaded. null until this browser loaded it once
const loginRequiredLS = new LocalStorageWithSchema({
  key: "loginRequired",
  schema: z.boolean().nullable(),
  fallback: null,
});

export function getLastKnownLoginRequired(): boolean | null {
  return loginRequiredLS.get();
}

export function setLastKnownLoginRequired(loginRequired: boolean | null): void {
  loginRequiredLS.set(loginRequired);
}
