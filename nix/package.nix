{
  lib,
  stdenv,
  nodejs_24,
  pnpm_11,
  fetchPnpmDeps,
  pnpmConfigHook,
  autoPatchelfHook,
  python3,
  makeWrapper,
  version ? "unstable",
  commitHash ? "unknown",
}:

let
  nodejs = nodejs_24;
  pnpm = pnpm_11;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../turbo.json
      ../packages
      ../backend
      ../frontend
    ];
  };

  pnpmDeps = fetchPnpmDeps {
    pname = "monkeytype";
    inherit version src pnpm;
    fetcherVersion = 4;
    hash = "sha256-bGbH6G3Q3s04RteQsW0txJ33zKRBLSNTi9UV9Eo5/Qo=";
  };

  # shared setup: install the workspace and build the internal packages
  mkMonkeytype =
    args:
    stdenv.mkDerivation (
      {
        inherit version src pnpmDeps;

        nativeBuildInputs = [
          nodejs
          pnpm
          pnpmConfigHook
          autoPatchelfHook
          python3
          makeWrapper
        ];

        # prebuilt binaries of the build tools (rolldown, lightningcss, typescript, ...)
        buildInputs = [ stdenv.cc.cc.lib ];

        env = {
          REDOCLY_TELEMETRY = "off";
          COMMIT_HASH = commitHash;
        };

        postConfigure = ''
          autoPatchelf node_modules/.pnpm
        '';

        preBuild = ''
          pnpm --filter "./packages/*" --recursive run build
        '';

        dontStrip = true;
      }
      // args
    );
in
{
  inherit pnpmDeps;

  backend = mkMonkeytype {
    pname = "monkeytype-backend";

    buildPhase = ''
      runHook preBuild

      pnpm --filter @monkeytype/backend run build

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      pnpm --offline --config.inject-workspace-packages=true deploy --filter @monkeytype/backend --prod deploy

      # deploy builds bcrypt from source, the prebuilt download isn't available offline
      test -f deploy/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node

      mkdir -p $out/lib/monkeytype-backend
      cp -r deploy/node_modules deploy/package.json $out/lib/monkeytype-backend/
      cp -r backend/dist backend/email-templates backend/redis-scripts $out/lib/monkeytype-backend/
      echo -n "${version}_${commitHash}" > $out/lib/monkeytype-backend/dist/server.version

      makeWrapper ${lib.getExe nodejs} $out/bin/monkeytype-backend \
        --add-flags $out/lib/monkeytype-backend/dist/server.js

      runHook postInstall
    '';

    meta.mainProgram = "monkeytype-backend";
  };

  frontend = lib.makeOverridable (
    {
      backendUrl,
      authProvider ? "firebase",
      oidcAuthority ? "",
      oidcClientId ? "",
      oidcScope ? "",
      oidcDisplayName ? "",
      oidcAccountUrl ? "",
      recaptchaSiteKey ? "",
      selfHosted ? true,
    }:
    mkMonkeytype {
      pname = "monkeytype-frontend";

      env = {
        BACKEND_URL = backendUrl;
        AUTH_PROVIDER = authProvider;
        OIDC_AUTHORITY = oidcAuthority;
        OIDC_CLIENT_ID = oidcClientId;
        OIDC_SCOPE = oidcScope;
        OIDC_DISPLAY_NAME = oidcDisplayName;
        OIDC_ACCOUNT_URL = oidcAccountUrl;
        RECAPTCHA_SITE_KEY = recaptchaSiteKey;
        SELF_HOSTED = lib.boolToString selfHosted;
      };

      buildPhase = ''
        runHook preBuild

        # firebase config is required by the build even when firebase isn't used
        cp frontend/src/ts/constants/firebase-config-example.ts frontend/src/ts/constants/firebase-config.ts
        cp frontend/src/ts/constants/firebase-config-example.ts frontend/src/ts/constants/firebase-config-live.ts

        pnpm --filter @monkeytype/frontend run build

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall
        cp -r frontend/dist $out
        runHook postInstall
      '';
    }
  ) { backendUrl = "http://localhost:5005"; };
}
