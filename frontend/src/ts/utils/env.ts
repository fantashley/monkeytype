import { envConfig } from "virtual:env-config";

export function isDevEnvironment(): boolean {
  return envConfig.isDevelopment;
}

export function isSelfHosted(): boolean {
  return envConfig.isSelfHosted;
}
