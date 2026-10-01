FROM node:24.11.0-alpine3.22 AS builder
WORKDIR /app

#ENV
ENV BACKEND_URL=###MONKEYTYPE_BACKENDURL### RECAPTCHA_SITE_KEY=###RECAPTCHA_SITE_KEY###
ENV AUTH_PROVIDER=###AUTH_PROVIDER### OIDC_AUTHORITY=###OIDC_AUTHORITY### OIDC_CLIENT_ID=###OIDC_CLIENT_ID### OIDC_SCOPE=###OIDC_SCOPE### OIDC_DISPLAY_NAME=###OIDC_DISPLAY_NAME### OIDC_ACCOUNT_URL=###OIDC_ACCOUNT_URL###

#COPY
COPY ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "./"]
COPY packages packages
COPY frontend frontend

COPY docker/frontend/firebase-config-live.ts frontend/src/ts/constants/firebase-config.ts
COPY docker/frontend/firebase-config-live.ts frontend/src/ts/constants/firebase-config-live.ts

#gimme pnpm + build
RUN npm i -g pnpm@11.21.0 && \
    pnpm i --frozen-lockfile && \
    npm run build

# COPY to target
FROM nginx:mainline-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/frontend/updateConfig.sh /docker-entrypoint.d/updateConfig.sh
RUN chmod +x /docker-entrypoint.d/updateConfig.sh

# entry
#CMD ["./entryPoint.sh"]
