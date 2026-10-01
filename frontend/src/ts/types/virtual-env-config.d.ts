export type EnvConfig = {
  backendUrl: string;
  isDevelopment: boolean;
  clientVersion: string;
  recaptchaSiteKey: string;
  quickLoginEmail: string | undefined;
  quickLoginPassword: string | undefined;
  /**
   * built for a self hosted instance, disables ads, analytics, error reporting
   * and other requests to services run by monkeytype
   */
  isSelfHosted: boolean;
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
