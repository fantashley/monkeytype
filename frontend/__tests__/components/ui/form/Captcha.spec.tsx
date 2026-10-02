import { render } from "@solidjs/testing-library";
import { AnyFieldApi } from "@tanstack/solid-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  Captcha,
  CAPTCHA_DISABLED_TOKEN,
} from "../../../../src/ts/components/ui/form/Captcha";

const envConfig = vi.hoisted(() => ({ recaptchaSiteKey: "" }));
vi.mock("virtual:env-config", () => ({ envConfig }));

function makeField(): AnyFieldApi {
  return {
    name: "captcha",
    state: { value: "" },
    setValue: vi.fn(),
  } as unknown as AnyFieldApi;
}

function recaptchaScripts(): Element[] {
  return [...document.querySelectorAll("script")].filter((s) =>
    s.getAttribute("src")?.includes("recaptcha"),
  );
}

describe("Captcha", () => {
  beforeEach(() => {
    recaptchaScripts().forEach((s) => s.remove());
  });

  describe("without a site key", () => {
    beforeEach(() => {
      envConfig.recaptchaSiteKey = "";
    });

    it("sets the disabled token without loading recaptcha", () => {
      const field = makeField();
      const onSuccess = vi.fn();

      const { container } = render(() => (
        <Captcha field={() => field} onSuccess={onSuccess} />
      ));

      expect(field.setValue).toHaveBeenCalledWith(CAPTCHA_DISABLED_TOKEN);
      expect(onSuccess).toHaveBeenCalledWith(CAPTCHA_DISABLED_TOKEN);
      expect(container).toBeEmptyDOMElement();
      expect(recaptchaScripts()).toHaveLength(0);
    });
  });

  describe("with a site key", () => {
    beforeEach(() => {
      envConfig.recaptchaSiteKey = "site-key";
    });

    it("loads recaptcha and renders the widget", async () => {
      const field = makeField();
      const renderMock = vi.fn();

      render(() => <Captcha field={() => field} />);

      const scripts = recaptchaScripts();
      expect(scripts).toHaveLength(1);
      expect(scripts[0]?.getAttribute("src")).toContain("render=explicit");

      (window as unknown as { grecaptcha: unknown }).grecaptcha = {
        render: renderMock,
      };
      (window as unknown as { onRecaptchaLoad: () => void }).onRecaptchaLoad();
      await vi.waitFor(() => {
        expect(renderMock).toHaveBeenCalledWith(expect.any(HTMLElement), {
          sitekey: "site-key",
          callback: expect.any(Function),
        });
      });
      expect(field.setValue).not.toHaveBeenCalled();
    });
  });
});
