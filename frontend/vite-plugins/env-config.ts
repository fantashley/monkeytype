import { Plugin } from "vite";
import { EnvConfig } from "virtual:env-config";

const virtualModuleId = "virtual:env-config";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

function fallback(value: string | undefined | null, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

export function envConfig(options: {
  isDevelopment: boolean;
  clientVersion: string;
  env: Record<string, string>;
}): Plugin {
  return {
    name: "virtual-env-config",
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const authConfig: Pick<EnvConfig, "authProvider" | "oidc"> = {
          authProvider: fallback(options.env["AUTH_PROVIDER"], "firebase"),
          oidc: {
            authority: options.env["OIDC_AUTHORITY"] ?? "",
            clientId: options.env["OIDC_CLIENT_ID"] ?? "",
            scope: fallback(options.env["OIDC_SCOPE"], "openid profile email"),
            displayName: fallback(options.env["OIDC_DISPLAY_NAME"], "OIDC"),
            accountUrl: options.env["OIDC_ACCOUNT_URL"] ?? "",
          },
        };

        const devConfig: EnvConfig = {
          isDevelopment: true,
          backendUrl: fallback(
            options.env["BACKEND_URL"],
            "http://localhost:5005",
          ),
          clientVersion: options.clientVersion,
          recaptchaSiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
          quickLoginEmail: options.env["QUICK_LOGIN_EMAIL"],
          quickLoginPassword: options.env["QUICK_LOGIN_PASSWORD"],
          ...authConfig,
          isSelfHosted: options.env["SELF_HOSTED"] === "true",
        };

        const prodConfig: EnvConfig = {
          isDevelopment: false,
          backendUrl: fallback(
            options.env["BACKEND_URL"],
            "https://api.monkeytype.com",
          ),
          recaptchaSiteKey: options.env["RECAPTCHA_SITE_KEY"] ?? "",
          quickLoginEmail: undefined,
          quickLoginPassword: undefined,
          isSelfHosted: options.env["SELF_HOSTED"] === "true",
          clientVersion: options.clientVersion,
          ...authConfig,
        };

        const envConfig = options.isDevelopment ? devConfig : prodConfig;
        return `
          export const envConfig = ${JSON.stringify(envConfig)};
        `;
      }
      return;
    },
  };
}
