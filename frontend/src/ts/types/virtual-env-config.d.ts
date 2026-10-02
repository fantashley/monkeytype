export type EnvConfig = {
  backendUrl: string;
  isDevelopment: boolean;
  clientVersion: string;
  recaptchaSiteKey: string;
  quickLoginEmail: string | undefined;
  quickLoginPassword: string | undefined;
  /** "firebase" (default) or "oidc" */
  authProvider: string;
  oidc: {
    authority: string;
    clientId: string;
    scope: string;
    /** name of the identity provider shown on the login page */
    displayName: string;
    /** page where users manage their account at the identity provider */
    accountUrl: string;
  };
  /**
   * built for a self hosted instance, disables ads, analytics, error reporting
   * and other requests to services run by monkeytype
   */
  isSelfHosted: boolean;
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
