import FirebaseAdmin, {
  init as initFirebaseAdmin,
} from "../init/firebase-admin";
import { getFrontendUrl } from "../utils/misc";
import { AuthProvider } from "./types";

export const firebaseAuthProvider: AuthProvider = {
  name: "firebase",

  init: async () => {
    initFirebaseAdmin();
  },

  verifyIdToken: async (idToken) =>
    await FirebaseAdmin().auth().verifyIdToken(idToken, true),

  revokeTokens: async (uid) => {
    await FirebaseAdmin().auth().revokeRefreshTokens(uid);
  },

  createUser: async (email, password, displayName) => {
    const { uid } = await FirebaseAdmin().auth().createUser({
      displayName,
      password,
      email,
      emailVerified: true,
    });
    return uid;
  },

  deleteUser: async (uid) => {
    await FirebaseAdmin().auth().deleteUser(uid);
  },

  updateUserEmail: async (uid, email) => {
    await FirebaseAdmin().auth().updateUser(uid, {
      email,
      emailVerified: false,
    });
  },

  updateUserPassword: async (uid, password) => {
    await FirebaseAdmin().auth().updateUser(uid, {
      password,
    });
  },

  isEmailVerified: async (uid) =>
    (await FirebaseAdmin().auth().getUser(uid)).emailVerified,

  generateEmailVerificationLink: async (email) =>
    await FirebaseAdmin()
      .auth()
      .generateEmailVerificationLink(email, { url: getFrontendUrl() }),

  generatePasswordResetLink: async (email) => {
    const uid = (await FirebaseAdmin().auth().getUserByEmail(email)).uid;
    const link = await FirebaseAdmin()
      .auth()
      .generatePasswordResetLink(email, { url: getFrontendUrl() });
    return { uid, link };
  },
};
