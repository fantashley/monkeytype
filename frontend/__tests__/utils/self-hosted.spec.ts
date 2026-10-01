import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IndexHtmlTransformHook } from "vite";

import { selfHostedHtml } from "../../vite-plugins/self-hosted-html";
import { fetchLatestVersion } from "../../src/ts/utils/version";
import * as JsonData from "../../src/ts/utils/json-data";

const envConfig = vi.hoisted(() => ({
  isDevelopment: false,
  isSelfHosted: true,
}));
vi.mock("virtual:env-config", () => ({ envConfig }));

describe("self hosted", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("selfHostedHtml", () => {
    const html = `<head>
  <link rel="preconnect" href="https://api.monkeytype.com" />
  <link rel="preconnect" href="https://www.google.com" />
  <link rel="preload" href="/font.woff2" as="font" />
</head>`;

    function transform(isSelfHosted: boolean): string {
      const plugin = selfHostedHtml({ isSelfHosted });
      const hook = plugin.transformIndexHtml as {
        handler: IndexHtmlTransformHook;
      };
      return hook.handler.call({} as never, html, {} as never) as string;
    }

    it("removes preconnect hints", () => {
      const result = transform(true);
      expect(result).not.toContain("preconnect");
      expect(result).toContain(`rel="preload"`);
    });

    it("keeps the html for other builds", () => {
      expect(transform(false)).toEqual(html);
    });
  });

  it("does not check github for new versions", async () => {
    const githubMock = vi.spyOn(JsonData, "getLatestReleaseFromGitHub");

    await expect(fetchLatestVersion()).resolves.toBeNull();
    expect(githubMock).not.toHaveBeenCalled();
  });
});
