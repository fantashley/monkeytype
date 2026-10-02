import { JSXElement } from "solid-js";
import { envConfig } from "virtual:env-config";

import { signInWithOidc } from "../../../auth";
import {
  disableLoginPageInputs,
  enableLoginPageInputs,
  getLoginPageInputsEnabled,
} from "../../../states/login";
import { showErrorNotification } from "../../../states/notifications";
import { Button } from "../../common/Button";
import { H3 } from "../../common/Headers";

export function OidcLogin(): JSXElement {
  const signIn = async (): Promise<void> => {
    disableLoginPageInputs();
    const result = await signInWithOidc();
    if (!result.success) {
      showErrorNotification(`Failed to sign in: ${result.message}`);
      enableLoginPageInputs();
    }
    // on success the browser is redirected to the identity provider
  };

  return (
    <div class="grid w-full grid-cols-1 justify-center gap-2 sm:w-80">
      <H3 text="login" fa={{ icon: "fa-sign-in-alt" }} class="p-0" />
      <Button
        fa={{ icon: "fa-sign-in-alt" }}
        text={`sign in with ${envConfig.oidc.displayName}`}
        onClick={() => void signIn()}
        disabled={!getLoginPageInputsEnabled()}
      />
    </div>
  );
}
