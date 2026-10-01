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
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
