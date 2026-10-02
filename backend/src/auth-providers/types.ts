export type AuthProviderName = "firebase" | "oidc";

export type VerifiedIdToken = {
  uid: string;
  email?: string;
  /** issued at, in seconds */
  iat: number;
  /** expiration time, in seconds */
  exp: number;
};

export type PasswordResetLink = {
  uid: string;
  link: string;
};

/**
 * An authentication system that issues the bearer tokens used by the frontend.
 *
 * Optional methods are only implemented by providers that let the backend manage
 * user credentials. Providers that leave identity management to an external
 * service (e.g. OIDC) omit them.
 */
export type AuthProvider = {
  name: AuthProviderName;
  init: () => Promise<void>;
  /**
   * Verify the token and check if it was revoked.
   * Throws a MonkeyError if the token is invalid.
   */
  verifyIdToken: (idToken: string) => Promise<VerifiedIdToken>;
  revokeTokens: (uid: string) => Promise<void>;

  createUser?: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<string>;
  deleteUser?: (uid: string) => Promise<void>;
  updateUserEmail?: (uid: string, email: string) => Promise<void>;
  updateUserPassword?: (uid: string, password: string) => Promise<void>;
  isEmailVerified?: (uid: string) => Promise<boolean>;
  generateEmailVerificationLink?: (email: string) => Promise<string>;
  generatePasswordResetLink?: (email: string) => Promise<PasswordResetLink>;
};
