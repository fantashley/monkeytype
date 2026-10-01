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

# Replace a placeholder inside a JavaScript string literal with a value.
# The value is escaped for the JavaScript string (\ " ' ` $) and then for the
# sed replacement (\ & and the | delimiter).
replace_string() {
  escaped=$(printf '%s' "$2" |
    sed -e 's/[\\"'"'"'`$]/\\&/g' |
    sed -e 's/[\\&|]/\\&/g')
  sed -i "s|###$1###|${escaped}|g" js/*.js
}

AUTH_PROVIDER="${AUTH_PROVIDER:-firebase}"
echo "use auth provider ${AUTH_PROVIDER}"
replace_string AUTH_PROVIDER "${AUTH_PROVIDER}"
replace_string OIDC_AUTHORITY "${OIDC_AUTHORITY}"
replace_string OIDC_CLIENT_ID "${OIDC_CLIENT_ID}"
replace_string OIDC_SCOPE "${OIDC_SCOPE:-openid profile email}"
replace_string OIDC_DISPLAY_NAME "${OIDC_DISPLAY_NAME:-OIDC}"
replace_string OIDC_ACCOUNT_URL "${OIDC_ACCOUNT_URL}"
