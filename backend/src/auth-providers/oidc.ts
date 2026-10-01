import { createRemoteJWKSet, errors, jwtVerify, JWTVerifyGetKey } from "jose";
import * as RedisClient from "../init/redis";
import MonkeyError from "../utils/error";
import Logger from "../utils/logger";
import { AuthProvider } from "./types";

type OidcConfig = {
  issuer: string;
  clientId: string;
  jwks: JWTVerifyGetKey;
};

let config: OidcConfig | undefined;

function getRevokedKey(uid: string): string {
  return `auth:tokens-revoked-at:${uid}`;
}

function getConfig(): OidcConfig {
  if (config === undefined) {
    throw new MonkeyError(
      500,
      "OIDC provider not initialized",
      "oidc getConfig()",
    );
  }
  return config;
}

async function isRevoked(uid: string, authTime: number): Promise<boolean> {
  const connection = RedisClient.getConnection();
  if (connection === null) {
    Logger.warning("Redis not connected, skipping OIDC token revocation check");
    return false;
  }
  const revokedAt = await connection.get(getRevokedKey(uid));
  if (revokedAt === null) return false;
  return authTime * 1000 <= parseInt(revokedAt, 10);
}

export const oidcAuthProvider: AuthProvider = {
  name: "oidc",

  init: async () => {
    const issuer = process.env["OIDC_ISSUER"];
    const clientId = process.env["OIDC_CLIENT_ID"];

    if (
      issuer === undefined ||
      issuer === "" ||
      clientId === undefined ||
      clientId === ""
    ) {
      throw new MonkeyError(
        500,
        "OIDC_ISSUER and OIDC_CLIENT_ID are required when AUTH_PROVIDER is oidc",
        "init() oidc.ts",
      );
    }

    const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new MonkeyError(
        500,
        `Failed to fetch OIDC discovery document from ${discoveryUrl}: ${response.status}`,
        "init() oidc.ts",
      );
    }
    const discovery = (await response.json()) as {
      issuer?: string;
      jwks_uri?: string;
    };

    if (discovery.issuer === undefined || discovery.jwks_uri === undefined) {
      throw new MonkeyError(
        500,
        "OIDC discovery document is missing issuer or jwks_uri",
        "init() oidc.ts",
      );
    }

    config = {
      issuer: discovery.issuer,
      clientId,
      jwks: createRemoteJWKSet(new URL(discovery.jwks_uri)),
    };
    Logger.success(`OIDC provider initialized for ${discovery.issuer}`);
  },

  verifyIdToken: async (idToken) => {
    const { issuer, clientId, jwks } = getConfig();

    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer,
        audience: clientId,
        requiredClaims: ["sub", "iat", "exp"],
      });

      const uid = payload.sub as string;
      const iat = payload.iat as number;
      // auth_time stays the same when tokens are refreshed, so revoking it
      // forces the user to sign in again instead of only rotating tokens
      const authTime =
        typeof payload["auth_time"] === "number" ? payload["auth_time"] : iat;

      if (await isRevoked(uid, authTime)) {
        throw new MonkeyError(401, "Token revoked - please login again");
      }

      return {
        uid,
        email:
          typeof payload["email"] === "string" ? payload["email"] : undefined,
        iat,
        exp: payload.exp as number,
      };
    } catch (error) {
      if (error instanceof MonkeyError) throw error;
      if (error instanceof errors.JWTExpired) {
        throw new MonkeyError(401, "Token expired - please login again");
      }
      if (error instanceof errors.JOSEError) {
        throw new MonkeyError(401, `Invalid token: ${error.message}`);
      }
      throw error;
    }
  },

  revokeTokens: async (uid) => {
    const connection = RedisClient.getConnection();
    if (connection === null) {
      throw new MonkeyError(500, "Redis connection not found");
    }
    await connection.set(getRevokedKey(uid), Date.now().toString());
  },
};
