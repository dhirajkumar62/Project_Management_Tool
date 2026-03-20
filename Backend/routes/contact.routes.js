const express = require("express");
const router = express.Router();
const sendContactEmail = require("../utils/contactEmail");

router.post("/send", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields (name, email, message) are required" });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({ message: "Message must be at least 10 characters long" });
    }

   
    await sendContactEmail(name, email, message);

    console.log(`Contact form submitted by ${email}`);
    res.json({ message: "Message sent successfully! We'll get back to you soon." });

  } catch (err) {
    console.error("Contact form error:", err.message);
    
    if (err.message.includes("Invalid email")) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    res.status(500).json({ message: "Failed to send message. Please try again later." });
  }
});

module.exports = router;
