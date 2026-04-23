import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import { generateUsername, normalizeEmail } from "../utils/userProfile.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET_ID;
const defaultCallback = "http://localhost:4000/api/auth/google/callback";
const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || defaultCallback;

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile?.id;
          if (!googleId) {
            return done(new Error("Missing Google profile id"));
          }

          const normalizedEmail = normalizeEmail(profile?.emails?.[0]?.value);
          let user = await User.findOne({ googleId });

          if (!user && normalizedEmail) {
            user = await User.findOne({ email: normalizedEmail });
          }

          if (!user) {
            const username = await generateUsername([
              profile?.displayName,
              profile?.name?.givenName,
              normalizedEmail?.split("@")[0],
              googleId,
            ]);

            user = await User.create({
              firebaseUid: `google:${googleId}`,
              email: normalizedEmail,
              displayName: profile?.displayName || profile?.name?.givenName || "Player",
              avatar: profile?.photos?.[0]?.value,
              username,
              googleId,
              authProvider: "google",
              isProfileComplete: false,
            });
          } else {
            let needsSave = false;

            if (!user.googleId) {
              user.googleId = googleId;
              needsSave = true;
            }

            if (!user.firebaseUid) {
              user.firebaseUid = `google:${googleId}`;
              needsSave = true;
            }

            if (!user.email && normalizedEmail) {
              user.email = normalizedEmail;
              needsSave = true;
            }

            if (!user.displayName && profile?.displayName) {
              user.displayName = profile.displayName;
              needsSave = true;
            }

            if (!user.avatar && profile?.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
              needsSave = true;
            }

            if (user.authProvider !== "google") {
              user.authProvider = "google";
              needsSave = true;
            }

            if (needsSave) {
              await user.save();
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or GOOGLE_SECRET_ID) not provided - Google OAuth disabled.");
}

passport.serializeUser((user, done) => {
  done(null, user?._id?.toString() || null);
});

passport.deserializeUser(async (id, done) => {
  if (!id) {
    return done(null, false);
  }

  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (error) {
    done(error, null);
  }
});
