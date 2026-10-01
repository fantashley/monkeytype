#!/bin/sh
cd  /usr/share/nginx/html
echo "replace firebase config appid: ${FIREBASE_APPID}"
sed -i "s/###FIREBASE_APIKEY###/${FIREBASE_APIKEY}/g" js/firebase-config-live.*.js
sed -i "s/###FIREBASE_AUTHDOMAIN###/${FIREBASE_AUTHDOMAIN}/g" js/firebase-config-live.*.js
sed -i "s/###FIREBASE_PROJECTID###/${FIREBASE_PROJECTID}/g" js/firebase-config-live.*.js
sed -i "s/###FIREBASE_STORAGEBUCKET###/${FIREBASE_STORAGEBUCKET}/g" js/firebase-config-live.*.js
sed -i "s/###FIREBASE_MESSAGINGSENDERID###/${FIREBASE_MESSAGINGSENDERID}/g" js/firebase-config-live.*.js
sed -i "s/###FIREBASE_APPID###/${FIREBASE_APPID}/g" js/firebase-config-live.*.js


echo "use backend url ${MONKEYTYPE_BACKENDURL}"
sed -i "s/###MONKEYTYPE_BACKENDURL###/${MONKEYTYPE_BACKENDURL//\//\\/}/g" js/*.js

echo "use recaptcha ${RECAPTCHA_SITE_KEY}"
sed -i "s/###RECAPTCHA_SITE_KEY###/${RECAPTCHA_SITE_KEY//\//\\/}/g" js/*.js

AUTH_PROVIDER="${AUTH_PROVIDER:-firebase}"
echo "use auth provider ${AUTH_PROVIDER}"
sed -i "s/###AUTH_PROVIDER###/${AUTH_PROVIDER}/g" js/*.js
sed -i "s/###OIDC_AUTHORITY###/${OIDC_AUTHORITY//\//\\/}/g" js/*.js
sed -i "s/###OIDC_CLIENT_ID###/${OIDC_CLIENT_ID//\//\\/}/g" js/*.js
OIDC_SCOPE="${OIDC_SCOPE:-openid profile email}"
sed -i "s/###OIDC_SCOPE###/${OIDC_SCOPE//\//\\/}/g" js/*.js
OIDC_DISPLAY_NAME="${OIDC_DISPLAY_NAME:-OIDC}"
sed -i "s/###OIDC_DISPLAY_NAME###/${OIDC_DISPLAY_NAME//\//\\/}/g" js/*.js
sed -i "s/###OIDC_ACCOUNT_URL###/${OIDC_ACCOUNT_URL//\//\\/}/g" js/*.js
