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

  # the dependencies and the internal packages, without the backend and
  # frontend sources, so that changes to those don't reinstall the workspace
  workspaceSrc = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../packages
      ../backend/package.json
      ../frontend/package.json
      ../frontend/storybook/package.json
    ];
  };

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
    inherit version pnpm;
    src = workspaceSrc;
    fetcherVersion = 4;
    hash = "sha256-bGbH6G3Q3s04RteQsW0txJ33zKRBLSNTi9UV9Eo5/Qo=";
  };

  # the installed workspace with the internal packages built. Its inputs don't
  # include the version or the backend and frontend sources, so it's only
  # rebuilt when the dependencies or the internal packages change.
  #
  # out: the source tree with every node_modules and the built packages
  # backendModules: the backend's production node_modules
  workspace = stdenv.mkDerivation {
    pname = "monkeytype-workspace";
    version = "0";
    src = workspaceSrc;
    inherit pnpmDeps;

    outputs = [
      "out"
      "backendModules"
    ];

    nativeBuildInputs = [
      nodejs
      pnpm
      pnpmConfigHook
      autoPatchelfHook
      python3
    ];

    # prebuilt binaries of the build tools (rolldown, lightningcss, typescript, ...)
    buildInputs = [ stdenv.cc.cc.lib ];

    postConfigure = ''
      autoPatchelf node_modules/.pnpm
    '';

    buildPhase = ''
      runHook preBuild

      pnpm --filter "./packages/*" --recursive run build

      pnpm --offline --config.inject-workspace-packages=true deploy --filter @monkeytype/backend --prod deploy

      # deploy builds bcrypt from source, the prebuilt download isn't available offline
      test -f deploy/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir $backendModules
      mv deploy/node_modules deploy/package.json $backendModules/
      rm -r deploy
      # the native modules built by deploy have $out/lib in their rpath, which
      # would make the backend depend on the whole workspace
      find $backendModules -name '*.node' -type f -exec patchelf --shrink-rpath {} \;
      cp -r . $out

      runHook postInstall
    '';

    # node_modules is used as installed, and has symlinks to packages that
    # weren't installed for this platform
    dontFixup = true;
  };

  # copies the workspace into the source tree to build the backend or frontend
  mkMonkeytype =
    args:
    stdenv.mkDerivation (
      {
        inherit version src;

        nativeBuildInputs = [
          nodejs
          pnpm
          makeWrapper
        ];

        env = {
          REDOCLY_TELEMETRY = "off";
          COMMIT_HASH = commitHash;
          # the workspace's packageManager pins a different pnpm version
          pnpm_config_pm_on_fail = "ignore";
          # the copied workspace looks outdated to pnpm, it can't reinstall offline
          pnpm_config_verify_deps_before_run = "false";
        }
        // args.env or { };

        configurePhase = ''
          runHook preConfigure

          cp -r ${workspace}/. .
          chmod -R u+w .

          runHook postConfigure
        '';

        dontStrip = true;
      }
      // removeAttrs args [ "env" ]
    );
in
{
  inherit pnpmDeps workspace;

  backend = mkMonkeytype {
    pname = "monkeytype-backend";

    buildPhase = ''
      runHook preBuild

      pnpm --filter @monkeytype/backend run build

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out/lib/monkeytype-backend
      ln -s ${workspace.backendModules}/node_modules $out/lib/monkeytype-backend/node_modules
      cp ${workspace.backendModules}/package.json $out/lib/monkeytype-backend/
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
