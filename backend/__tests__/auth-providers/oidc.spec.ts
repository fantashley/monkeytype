import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { exportJWK, generateKeyPair, SignJWT, CryptoKey, JWK } from "jose";
import * as RedisClient from "../../src/init/redis";
import { oidcAuthProvider } from "../../src/auth-providers/oidc";
import MonkeyError from "../../src/utils/error";

const issuer = "https://id.example.com";
const clientId = "monkeytype-client";

describe("oidc auth provider", () => {
  let privateKey: CryptoKey;
  let jwk: JWK;
  const redisMock = {
    get: vi.fn(),
    set: vi.fn(),
  };

  beforeAll(async () => {
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;
    jwk = {
      ...(await exportJWK(keyPair.publicKey)),
      kid: "key1",
      alg: "RS256",
    };

    vi.stubEnv("OIDC_ISSUER", `${issuer}/`);
    vi.stubEnv("OIDC_CLIENT_ID", clientId);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === `${issuer}/.well-known/openid-configuration`) {
          return Response.json({
            issuer,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
          });
        }
        if (url === `${issuer}/.well-known/jwks.json`) {
          return Response.json({ keys: [jwk] });
        }
        return new Response(null, { status: 404 });
      }),
    );

    vi.spyOn(RedisClient, "getConnection").mockReturnValue(
      redisMock as unknown as ReturnType<typeof RedisClient.getConnection>,
    );
    vi.spyOn(RedisClient, "isConnected").mockReturnValue(true);

    await oidcAuthProvider.init();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset();
  });

  async function createToken(
    claims: Record<string, unknown> = {},
    options: { audience?: string; issuer?: string; expiresIn?: string } = {},
  ): Promise<string> {
    return await new SignJWT({
      email: "user@example.com",
      auth_time: Math.floor(Date.now() / 1000),
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "key1" })
      .setSubject("user-uid")
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? clientId)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "1h")
      .sign(privateKey);
  }

  describe("verifyIdToken", () => {
    it("returns the uid and email of a valid token", async () => {
      const token = await createToken();

      const decoded = await oidcAuthProvider.verifyIdToken(token);

      expect(decoded.uid).toEqual("user-uid");
      expect(decoded.email).toEqual("user@example.com");
      expect(decoded.exp - decoded.iat).toEqual(3600);
    });

    it("rejects a token for another client", async () => {
      const token = await createToken({}, { audience: "other-client" });

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toThrow(
        MonkeyError,
      );
    });

    it("rejects a token from another issuer", async () => {
      const token = await createToken({}, { issuer: "https://evil.example" });

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toThrow(
        "Invalid token",
      );
    });

    it("rejects an expired token", async () => {
      const token = await createToken({}, { expiresIn: "-1m" });

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toThrow(
        "Token expired - please login again",
      );
    });

    it("rejects a malformed token", async () => {
      await expect(oidcAuthProvider.verifyIdToken("not-a-jwt")).rejects.toThrow(
        "Invalid token",
      );
    });

    it("rejects a token authenticated before the tokens were revoked", async () => {
      const authTime = Math.floor(Date.now() / 1000) - 60;
      const token = await createToken({ auth_time: authTime });
      redisMock.get.mockResolvedValue((Date.now() - 1000).toString());

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toThrow(
        "Token revoked - please login again",
      );
      expect(redisMock.get).toHaveBeenCalledWith(
        "auth:tokens-revoked-at:user-uid",
      );
    });

    it("rejects a token without auth_time", async () => {
      const token = await createToken({ auth_time: undefined });

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toThrow(
        'missing required "auth_time" claim',
      );
    });

    it("fails closed when redis is unavailable", async () => {
      const token = await createToken();
      vi.mocked(RedisClient.isConnected).mockReturnValueOnce(false);

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toMatchObject(
        {
          status: 503,
        },
      );
    });

    it("fails closed when the revocation lookup fails", async () => {
      const token = await createToken();
      redisMock.get.mockRejectedValue(new Error("connection lost"));

      await expect(oidcAuthProvider.verifyIdToken(token)).rejects.toMatchObject(
        {
          status: 503,
        },
      );
    });

    it("accepts a token authenticated after the tokens were revoked", async () => {
      const token = await createToken({
        auth_time: Math.floor(Date.now() / 1000) + 1,
      });
      redisMock.get.mockResolvedValue(Date.now().toString());

      await expect(oidcAuthProvider.verifyIdToken(token)).resolves.toEqual(
        expect.objectContaining({ uid: "user-uid" }),
      );
    });
  });

  describe("revokeTokens", () => {
    it("stores the revocation time", async () => {
      vi.useFakeTimers({ now: 1_000_000 });

      await oidcAuthProvider.revokeTokens("user-uid");

      expect(redisMock.set).toHaveBeenCalledWith(
        "auth:tokens-revoked-at:user-uid",
        "1000000",
      );
      vi.useRealTimers();
    });
  });

  it("does not manage user accounts", () => {
    expect(oidcAuthProvider.deleteUser).toBeUndefined();
    expect(oidcAuthProvider.updateUserEmail).toBeUndefined();
    expect(oidcAuthProvider.updateUserPassword).toBeUndefined();
    expect(oidcAuthProvider.generatePasswordResetLink).toBeUndefined();
  });
});
