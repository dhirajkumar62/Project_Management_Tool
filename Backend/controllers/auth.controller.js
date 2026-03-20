const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis").redisClient;
const sendEmail = require("../utils/sendEmail");

/* ================= REGISTER ================= */
exports.registerUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;


    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || "user",
      isVerified: false
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();


    await redisClient.set(
      `verify:${email}`,
      otp,
      { EX: 120 }
    );

    // Send OTP via email
    try {
      await sendEmail(email, otp);
      console.log(`OTP sent to ${email}`);
    } catch (emailError) {
      console.error(`Email failed for ${email}: ${emailError.message}`);

      return res.status(500).json({
        message: "Account created but email failed. Check EMAIL_USER and EMAIL_PASS in .env"
      });
    }

    res.status(201).json({
      message: "OTP sent to your email. Please verify your account."
    });

  } catch (error) {
    console.error("Register error:", error.message);
    console.error("Full error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= VERIFY ACCOUNT ================= */
exports.verifyAccount = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOtp = await redisClient.get(`verify:${email}`);

    if (!storedOtp || storedOtp !== otp)
      return res.status(400).json({
        message: "Invalid or expired OTP"
      });

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    await redisClient.del(`verify:${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log(`Account verified successfully for: ${email}`);

    res.json({
      message: "Account verified successfully",
      token,
      role: user.role
    });

  } catch (error) {
    console.error("Verify error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= LOGIN ================= */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified)
      return res.status(403).json({
        message: "Please verify your account first"
      });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      username: user.username,
      email: user.email
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= FORGOT PASSWORD ================= */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await redisClient.set(
      `reset:${email}`,
      otp,
      { EX: 120 } // 120 seconds = 2 minutes
    );

    // Send OTP via email
    try {
      await sendEmail(email, otp, "reset");
      console.log(`Password reset OTP sent to ${email}`);
    } catch (emailError) {
      console.error(`Email failed for ${email}: ${emailError.message}`);
      return res.status(500).json({
        message: "Email failed. Check EMAIL_USER and EMAIL_PASS in .env"
      });
    }

    res.json({ message: "OTP sent to your email" });

  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= RESET PASSWORD ================= */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const storedOtp = await redisClient.get(`reset:${email}`);

    if (!storedOtp || storedOtp !== otp)
      return res.status(400).json({
        message: "Invalid or expired OTP"
      });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    await redisClient.del(`reset:${email}`);

    res.json({ message: "Password reset successful" });

  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PROFILE ================= */
exports.updateProfile = async (req, res) => {
  try {
    const { username, email, avatar } = req.body;
    const userId = req.user.id || req.user._id;

    if (!username && !email && !avatar) {
      return res.status(400).json({ message: "At least one field is required to update" });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (avatar) updateData.avatar = avatar;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = email;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar
      }
    });

  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= CHANGE PASSWORD ================= */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findById(userId);

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword }
    );

    res.json({ message: "Password changed successfully" });

  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= GET CURRENT USER ================= */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get me error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
