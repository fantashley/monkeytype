import { describe, it, expect, afterEach, vi } from "vitest";
import { verify } from "../../src/utils/captcha";

describe("captcha", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips verification when disabled", async () => {
    vi.stubEnv("MODE", "prod");
    vi.stubEnv("CAPTCHA_DISABLED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verify("token")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires the recaptcha secret when enabled", async () => {
    vi.stubEnv("MODE", "prod");

    await expect(verify("token")).rejects.toThrow(
      "RECAPTCHA_SECRET is not defined",
    );
  });
});
