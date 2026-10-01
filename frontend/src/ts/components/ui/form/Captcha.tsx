import { AnyFieldApi } from "@tanstack/solid-form";
import { Accessor, createEffect, onMount, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import { useRefWithUtils } from "../../../hooks/useRefWithUtils";
import { showErrorNotification } from "../../../states/notifications";
import { ElementWithUtils } from "../../../utils/dom";

const errorText =
  "Captcha is not available. This could happen due to a blocked or failed network request. Please refresh the page or contact support if this issue persists.";

/**
 * token sent to the backend when the captcha is disabled
 */
export const CAPTCHA_DISABLED_TOKEN = "captcha-disabled";

type Grecaptcha = {
  render: (
    element: HTMLElement,
    options: { sitekey: string; callback?: (responseToken: string) => void },
  ) => number;
  reset: (widgetId: number) => void;
  getResponse: (widgetId: number) => string;
};

/**
 * captcha is disabled if the frontend is built without a recaptcha site key
 */
export function isCaptchaEnabled(): boolean {
  return envConfig.recaptchaSiteKey !== "";
}

export function Captcha(props: {
  field: Accessor<AnyFieldApi>;
  class?: string;
  onSuccess?: (responseToken: string) => void;
}) {
  const [captchaRef, captchaEl] = useRefWithUtils<HTMLDivElement>();

  // keep the token set when the captcha is disabled, the form might get reset
  createEffect(() => {
    if (isCaptchaEnabled()) return;
    if (props.field().state.value !== CAPTCHA_DISABLED_TOKEN) {
      props.field().setValue(CAPTCHA_DISABLED_TOKEN);
    }
  });

  onMount(() => {
    if (!isCaptchaEnabled()) {
      props.onSuccess?.(CAPTCHA_DISABLED_TOKEN);
      return;
    }

    const el = captchaEl() as ElementWithUtils<HTMLDivElement>;

    void loadGrecaptcha().then((grecaptcha) => {
      if (grecaptcha === undefined) {
        el.setText(errorText);
        showErrorNotification(errorText);
        return;
      }
      grecaptcha.render(el.native, {
        sitekey: envConfig.recaptchaSiteKey,
        callback: (token) => {
          props.field().setValue(token);
          props.onSuccess?.(token);
        },
      });
    });
  });

  return (
    <Show when={isCaptchaEnabled()}>
      <div ref={captchaRef} class={props.class}></div>
    </Show>
  );
}

let grecaptchaPromise: Promise<Grecaptcha | undefined> | undefined;

/**
 * load the recaptcha script the first time a captcha is shown
 */
async function loadGrecaptcha(): Promise<Grecaptcha | undefined> {
  grecaptchaPromise ??= new Promise((resolve) => {
    const onLoadCallback = "onRecaptchaLoad";
    (window as unknown as Record<string, () => void>)[onLoadCallback] = () => {
      resolve((window as { grecaptcha?: Grecaptcha }).grecaptcha);
    };

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit&onload=${onLoadCallback}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      grecaptchaPromise = undefined;
      resolve(undefined);
    };
    document.head.appendChild(script);
  });
  return grecaptchaPromise;
}
