const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User.model");


try {
  require("./github");
  console.log("Loaded GitHub passport strategy");
} catch (e) {
  console.log("No GitHub passport strategy file found or failed to load.");
}
console.log("Passport Configuration:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Missing");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Missing");
console.log("GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL || "Missing");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        console.log(`Google OAuth callback for: ${email || profile.id}`);

        if (!email) {
          console.error("No email from Google profile");
          return done(new Error("No email from Google profile"), null);
        }

        
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          console.log(`Existing Google user found: ${user.email}`);
          return done(null, user);
        }

       
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          console.log(`Email exists but not linked to Google: ${email}`);
          existingUser.googleId = profile.id;
          await existingUser.save();
          return done(null, existingUser);
        }

        user = await User.create({
          googleId: profile.id,
          username: profile.displayName || email.split("@")[0],
          email: email,
          isVerified: true, 
          role: "user"
        });

        console.log(`New Google user created: ${email}`);
        done(null, user);

      } catch (err) {
        console.error(`Google OAuth error: ${err.message}`);
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error(`Deserialize error: ${err.message}`);
    done(err, null);
  }
});

module.exports = passport;
