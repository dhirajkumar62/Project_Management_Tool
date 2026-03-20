const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const {
  registerUser,
  verifyAccount,
  loginUser,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  getMe
} = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const User = require("../models/User.model");
const { redisClient } = require("../config/redis");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-account", verifyAccount);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* ================= PROTECTED ROUTES ================= */
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.get("/me", protect, getMe);

/* ================= RESEND OTP ================= */
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account already verified" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 2 min expiry
    await redisClient.set(
      `verify:${email}`,
      otp,
      { EX: 120 }
    );

    // Send OTP via email
    try {
      await sendEmail(email, otp);
      console.log(`✅ OTP resent successfully to ${email}`);
      res.json({ message: "OTP resent successfully" });
    } catch (emailError) {
      console.error(`⚠️ Email failed for ${email}: ${emailError.message}`);
      return res.status(500).json({
        message: "Failed to send OTP. Check email configuration."
      });
    }

  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

/* GOOGLE LOGIN */
router.get(
  "/google",
  (req, res, next) => {
    console.log("🔄 Starting Google OAuth flow...");
    console.log("📍 GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ Set" : "❌ Missing");
    console.log("📍 GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL);
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);


// Handle Google OAuth callback with better error handling
router.get("/google/callback", async (req, res, next) => {
  try {
    // Check for access_denied error from Google
    if (req.query.error === "access_denied") {
      console.log("User denied access on Google consent screen");
      return res.redirect(`${process.env.CLIENT_URL}/login?error=access_denied`);
    }

    if (req.query.error) {
      console.error(`Google OAuth error: ${req.query.error}`);
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${req.query.error}`);
    }

    // Proceed with authentication
    passport.authenticate("google", { session: false }, (err, user, info) => {
      try {
        if (err) {
          console.error(`Passport error: ${err.message}`);
          return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
        }

        if (!user) {
          console.error("No user returned from passport");
          return res.redirect(`${process.env.CLIENT_URL}/login?error=no_user`);
        }

        if (!user._id) {
          console.error("User has no _id");
          return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_user`);
        }

        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        console.log(`Google login successful for: ${user.email}`);

        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
      } catch (error) {
        console.error(`Token generation error: ${error.message}`);
        res.redirect(`${process.env.CLIENT_URL}/login?error=token_failed`);
      }
    })(req, res, next);
  } catch (error) {
    console.error("Critical error in Google OAuth callback:", error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
});

/* GITHUB LOGIN */
router.get(
  "/github",
  (req, res, next) => {
    console.log("🔄 Starting GitHub OAuth flow...");
    console.log("📍 GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Missing");
    console.log("📍 GITHUB_CALLBACK_URL:", process.env.GITHUB_CALLBACK_URL);
    next();
  },
  passport.authenticate("github", { scope: ["user:email"] })
);


router.get("/github/callback", (req, res, next) => {
  if (req.query.error) {
    console.error(`GitHub OAuth error: ${req.query.error}`);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=${req.query.error}`);
  }

  passport.authenticate("github", { session: false }, (err, user, info) => {
    if (err) {
      console.error(`Passport error: ${err.message}`);
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }

    if (!user) {
      console.error("No user returned from passport (GitHub)");
      return res.redirect(`${process.env.CLIENT_URL}/login?error=no_user`);
    }

    try {
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      console.log(`GitHub login successful for: ${user.email}`);
      res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
    } catch (error) {
      console.error(`Token generation error: ${error.message}`);
      res.redirect(`${process.env.CLIENT_URL}/login?error=token_failed`);
    }
  })(req, res, next);
});

module.exports = router;
