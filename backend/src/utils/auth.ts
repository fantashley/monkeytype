import { LRUCache } from "lru-cache";
import {
  recordTokenCacheAccess,
  setTokenCacheLength,
  setTokenCacheSize,
} from "./prometheus";
import emailQueue from "../queues/email-queue";
import * as UserDAL from "../dal/user";
import MonkeyError, { isFirebaseError } from "./error";
import { getAuthProvider } from "../auth-providers";
import { AuthProvider, VerifiedIdToken } from "../auth-providers/types";
import { v4 as uuidv4 } from "uuid";

const tokenCache = new LRUCache<string, VerifiedIdToken>({
  max: 20000,
  maxSize: 50000000, // 50MB
  sizeCalculation: (token, key): number =>
    JSON.stringify(token).length + key.length, //sizeInBytes
});

const TOKEN_CACHE_BUFFER = 1000 * 60 * 5; // 5 minutes

export async function init(): Promise<void> {
  await getAuthProvider().init();
}

function requireMethod<K extends keyof AuthProvider>(
  method: K,
): NonNullable<AuthProvider[K]> {
  const provider = getAuthProvider();
  const fn = provider[method];
  if (fn === undefined) {
    throw new MonkeyError(
      400,
      `This action is not supported by the configured authentication provider (${provider.name})`,
    );
  }
  return fn;
}

/**
 * Whether user accounts in the authentication system are managed by this backend.
 * When false, the accounts are managed by an external identity provider and the
 * backend can't create, delete or modify them.
 */
export function isAuthUserManagedByBackend(): boolean {
  return getAuthProvider().deleteUser !== undefined;
}

export async function verifyIdToken(
  idToken: string,
  noCache = false,
): Promise<VerifiedIdToken> {
  if (noCache) {
    return await getAuthProvider().verifyIdToken(idToken);
  }

  setTokenCacheLength(tokenCache.size);
  setTokenCacheSize(tokenCache.calculatedSize ?? 0);

  const cached = tokenCache.get(idToken);

  if (cached) {
    const expirationDate = cached.exp * 1000 - TOKEN_CACHE_BUFFER;

    if (expirationDate < Date.now()) {
      recordTokenCacheAccess("hit_expired");
      tokenCache.delete(idToken);
    } else {
      recordTokenCacheAccess("hit");
      return cached;
    }
  } else {
    recordTokenCacheAccess("miss");
  }

  const decoded = await getAuthProvider().verifyIdToken(idToken);
  tokenCache.set(idToken, decoded);
  return decoded;
}

/**
 * Create a user in the authentication system, used to generate dev data.
 * If the accounts are managed by an external provider a random uid is returned.
 */
export async function createUser(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const createUserFn = getAuthProvider().createUser;
  if (createUserFn === undefined) return uuidv4();
  return await createUserFn(email, password, displayName);
}

export async function updateUserEmail(
  uid: string,
  email: string,
): Promise<void> {
  const updateUserEmailFn = requireMethod("updateUserEmail");
  await revokeTokensByUid(uid);
  await updateUserEmailFn(uid, email);
}

export async function updateUserPassword(
  uid: string,
  password: string,
): Promise<void> {
  const updateUserPasswordFn = requireMethod("updateUserPassword");
  await revokeTokensByUid(uid);
  await updateUserPasswordFn(uid, password);
}

/**
 * Delete the user from the authentication system.
 * Does nothing if the accounts are managed by an external provider.
 */
export async function deleteUser(uid: string): Promise<void> {
  const deleteUserFn = getAuthProvider().deleteUser;
  if (deleteUserFn === undefined) return;
  await revokeTokensByUid(uid);
  await deleteUserFn(uid);
}

export async function revokeTokensByUid(uid: string): Promise<void> {
  await getAuthProvider().revokeTokens(uid);
  for (const entry of tokenCache.entries()) {
    if (entry[1].uid === uid) {
      tokenCache.delete(entry[0]);
    }
  }
}

export async function isEmailVerified(uid: string): Promise<boolean> {
  return await requireMethod("isEmailVerified")(uid);
}

export async function generateEmailVerificationLink(
  email: string,
): Promise<string> {
  return await requireMethod("generateEmailVerificationLink")(email);
}

export async function sendForgotPasswordEmail(email: string): Promise<void> {
  const generatePasswordResetLink = requireMethod("generatePasswordResetLink");
  try {
    const resetLink = await generatePasswordResetLink(email);

    const { name } = await UserDAL.getPartialUser(
      resetLink.uid,
      "request forgot password email",
      ["name"],
    );

    await emailQueue.sendForgotPasswordEmail(email, name, resetLink.link);
  } catch (err) {
    if (isFirebaseError(err) && err.errorInfo.code !== "auth/user-not-found") {
      // oxlint-disable-next-line only-throw-error
      throw err;
    }
  }
}
