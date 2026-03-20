const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const axios = require("axios");
const User = require("../models/User.model");

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      // Ensure GitHub API accepts our requests
      customHeaders: { "User-Agent": "Project Management Tool" }
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let email = profile.emails?.[0]?.value;
        // If passport didn't provide emails, try fetching them directly
        if (!email) {
          try {
            const resp = await axios.get("https://api.github.com/user/emails", {
              headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "Project Management Tool"
              }
            });
            const emails = Array.isArray(resp.data) ? resp.data : [];
            const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
            if (primary && primary.email) email = primary.email;
          } catch (fetchErr) {
            console.warn("Could not fetch GitHub emails via API:", fetchErr.message);
          }
        }
        console.log(`GitHub OAuth callback for: ${email || profile.username}`);

        // If email is missing, generate unique identifier from username+id
        const userEmail = email || `${profile.username}+${profile.id}@github.local`;
        const displayName = profile.displayName || profile.username || "github-user";

        // If a user already linked with this GitHub id
        let user = await User.findOne({ githubId: profile.id });
        if (user) {
          console.log(`Existing GitHub user found: ${user.email}`);
          return done(null, user);
        }

        // If email exists in DB, link the GitHub id
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
          console.log(`Email exists, linking GitHub id: ${userEmail}`);
          existingUser.githubId = profile.id;
          existingUser.isVerified = true;
          await existingUser.save();
          return done(null, existingUser);
        }

        // Create new user
        user = await User.create({
          githubId: profile.id,
          username: profile.username || displayName,
          email: userEmail,
          isVerified: true,
          role: "user"
        });

        console.log(`New GitHub user created: ${userEmail}`);
        return done(null, user);
      } catch (err) {
        console.error(`GitHub OAuth error: ${err.message}`);
        done(err, null);
      }
    }
  )
);
