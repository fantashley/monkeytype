self:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.monkeytype;
  inherit (lib) mkOption mkEnableOption types;

  settingsFormat = pkgs.formats.json { };
  configurationFile = settingsFormat.generate "backend-configuration.json" {
    configuration = cfg.settings;
  };

  isOidc = cfg.auth.provider == "oidc";
  captchaEnabled = cfg.recaptcha.siteKey != null;

  frontend = cfg.frontendPackage.override {
    backendUrl = "${cfg.url}/api";
    authProvider = if isOidc then "oidc" else "firebase";
    oidcAuthority = cfg.auth.oidc.issuer;
    oidcClientId = cfg.auth.oidc.clientId;
    oidcScope = cfg.auth.oidc.scope;
    oidcDisplayName = cfg.auth.oidc.displayName;
    oidcAccountUrl = cfg.auth.oidc.accountUrl;
    recaptchaSiteKey = if captchaEnabled then cfg.recaptcha.siteKey else "";
    selfHosted = true;
  };

  backendUrl = "http://127.0.0.1:${toString cfg.backendPort}";
in
{
  options.services.monkeytype = {
    enable = mkEnableOption "Monkeytype, a typing test";

    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.backend;
      defaultText = lib.literalExpression "monkeytype.packages.\${system}.backend";
      description = "The Monkeytype backend package.";
    };

    frontendPackage = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.frontend;
      defaultText = lib.literalExpression "monkeytype.packages.\${system}.frontend";
      description = ''
        The Monkeytype frontend package. It is rebuilt with the url and
        authentication settings of this module.
      '';
    };

    url = mkOption {
      type = types.str;
      example = "https://type.example.com";
      description = "Public url of the site, without a trailing slash.";
    };

    address = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Address nginx listens on for the site.";
    };

    port = mkOption {
      type = types.port;
      default = 8013;
      description = ''
        Port nginx listens on for the site. Put a TLS terminating reverse proxy
        in front of it, the frontend requires https.
      '';
    };

    backendPort = mkOption {
      type = types.port;
      default = 5005;
      description = "Port the backend listens on, on localhost.";
    };

    auth = {
      provider = mkOption {
        type = types.enum [
          "oidc"
          "none"
        ];
        default = "oidc";
        description = ''
          How users sign in. "none" disables accounts, "oidc" uses an OpenID Connect
          identity provider.
        '';
      };

      oidc = {
        issuer = mkOption {
          type = types.str;
          default = "";
          example = "https://id.example.com";
          description = "Issuer url of the identity provider.";
        };

        clientId = mkOption {
          type = types.str;
          default = "";
          description = ''
            Client id of a public client (PKCE, no secret) at the identity provider,
            with the callback urls `<url>/login` and `<url>/oidc-callback.html`.
          '';
        };

        scope = mkOption {
          type = types.str;
          default = "openid profile email";
          description = "Scopes requested from the identity provider.";
        };

        displayName = mkOption {
          type = types.str;
          default = "OIDC";
          description = "Name of the identity provider shown on the login page.";
        };

        accountUrl = mkOption {
          type = types.str;
          default = "";
          description = "Page where users manage their account, linked in the account settings.";
        };
      };
    };

    recaptcha = {
      siteKey = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = ''
          reCAPTCHA v2 site key. The captcha is disabled if null. The secret is
          read from RECAPTCHA_SECRET in {option}`services.monkeytype.environmentFile`.
        '';
      };
    };

    environmentFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Environment file with secrets for the backend, e.g. RECAPTCHA_SECRET or
        EMAIL_* settings.
      '';
    };

    settings = mkOption {
      inherit (settingsFormat) type;
      default = { };
      example = lib.literalExpression ''
        {
          users.signUp = true;
          results.savingEnabled = true;
        }
      '';
      description = ''
        Backend configuration, merged into the default configuration on startup. See
        backend/src/constants/base-configuration.ts for the available settings.
      '';
    };

    loginRequired = mkOption {
      type = types.bool;
      default = false;
      description = ''
        Only let signed in users use the site, including the typing test. Signed out
        users only see the login page. Sets `users.loginRequired` in
        {option}`services.monkeytype.settings` and enables sign up by default, the
        login page is disabled otherwise.
      '';
    };

    database = {
      createLocally = mkOption {
        type = types.bool;
        default = true;
        description = "Run MongoDB on this machine with {option}`services.mongodb`.";
      };

      uri = mkOption {
        type = types.str;
        default = "mongodb://127.0.0.1:27017";
        description = "MongoDB connection uri.";
      };

      name = mkOption {
        type = types.str;
        default = "monkeytype";
        description = "MongoDB database name.";
      };
    };

    redis = {
      createLocally = mkOption {
        type = types.bool;
        default = true;
        description = "Run a Redis server for Monkeytype on this machine.";
      };

      port = mkOption {
        type = types.port;
        default = 6390;
        description = "Port of the local Redis server.";
      };

      uri = mkOption {
        type = types.str;
        default = "redis://127.0.0.1:${toString cfg.redis.port}";
        defaultText = lib.literalExpression ''"redis://127.0.0.1:''${toString config.services.monkeytype.redis.port}"'';
        description = "Redis connection uri.";
      };
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = !isOidc || (cfg.auth.oidc.issuer != "" && cfg.auth.oidc.clientId != "");
        message = "services.monkeytype.auth.oidc.issuer and clientId are required for oidc authentication";
      }
      {
        assertion = !lib.hasSuffix "/" cfg.url;
        message = "services.monkeytype.url must not end with a slash";
      }
      {
        assertion = !cfg.loginRequired || cfg.auth.provider != "none";
        message = "services.monkeytype.loginRequired needs an auth provider to sign in with";
      }
    ];

    services.monkeytype.settings.users = lib.mkIf cfg.loginRequired {
      loginRequired = true;
      signUp = lib.mkDefault true;
    };

    services.mongodb = lib.mkIf cfg.database.createLocally {
      enable = true;
      bind_ip = "127.0.0.1";
    };

    services.redis.servers.monkeytype = lib.mkIf cfg.redis.createLocally {
      enable = true;
      bind = "127.0.0.1";
      inherit (cfg.redis) port;
    };

    systemd.services.monkeytype-backend = {
      description = "Monkeytype backend";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [
        "network-online.target"
      ]
      ++ lib.optional cfg.database.createLocally "mongodb.service"
      ++ lib.optional cfg.redis.createLocally "redis-monkeytype.service";
      requires =
        lib.optional cfg.database.createLocally "mongodb.service"
        ++ lib.optional cfg.redis.createLocally "redis-monkeytype.service";

      environment = {
        MODE = "prod";
        HOST = "127.0.0.1";
        PORT = toString cfg.backendPort;
        DB_URI = cfg.database.uri;
        DB_NAME = cfg.database.name;
        REDIS_URI = cfg.redis.uri;
        FRONTEND_URL = cfg.url;
        BACKEND_CONFIGURATION_PATH = "${configurationFile}";
        LOG_FOLDER_PATH = "/var/log/monkeytype";
        # the anticheat module isn't open source
        BYPASS_ANTICHEAT = "true";
        BYPASS_FIREBASE = "true";
        BYPASS_EMAILCLIENT = lib.mkDefault "true";
        CAPTCHA_DISABLED = lib.boolToString (!captchaEnabled);
      }
      // lib.optionalAttrs isOidc {
        AUTH_PROVIDER = "oidc";
        OIDC_ISSUER = cfg.auth.oidc.issuer;
        OIDC_CLIENT_ID = cfg.auth.oidc.clientId;
      };

      serviceConfig = {
        ExecStart = lib.getExe cfg.package;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        DynamicUser = true;
        StateDirectory = "monkeytype";
        LogsDirectory = "monkeytype";
        WorkingDirectory = "/var/lib/monkeytype";
        Restart = "always";
        RestartSec = 5;

        # hardening
        CapabilityBoundingSet = "";
        LockPersonality = true;
        NoNewPrivileges = true;
        PrivateDevices = true;
        PrivateTmp = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectSystem = "strict";
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
          # swagger-stats reads the network interfaces on startup
          "AF_NETLINK"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        SystemCallArchitectures = "native";
      };
    };

    services.nginx = {
      enable = true;
      virtualHosts.monkeytype = {
        serverName = lib.removePrefix "https://" (lib.removePrefix "http://" cfg.url);
        listen = [
          {
            addr = cfg.address;
            inherit (cfg) port;
          }
        ];
        root = frontend;

        locations."/" = {
          tryFiles = "$uri $uri/ /index.html";
        };

        locations."/api/" = {
          proxyPass = "${backendUrl}/";
          recommendedProxySettings = false;
          # the backend trusts these headers for rate limiting, the reverse proxy in
          # front of this server has to set X-Forwarded-For to the client address
          extraConfig = ''
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $http_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
            proxy_set_header CF-Connecting-IP "";
          '';
        };
      };
    };
  };
}
