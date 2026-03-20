const sendEmail = require("../utils/sendEmail");

exports.sendContactMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

   
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    
    const adminEmail = process.env.EMAIL_USER; 
    const subject = `New Contact Message from ${name}`;
    const htmlBody = `
      <h2>New Contact Message</h2>
      <p><strong>From:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `;

  
    const nodemailer = require("nodemailer");
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: subject,
      html: htmlBody,
      replyTo: email
    });

   
    
    const userConfirmation = `
      <h2>Thank You for Contacting Us</h2>
      <p>Hi ${name},</p>
      <p>We have received your message and will get back to you as soon as possible.</p>
      <p><strong>Your Message:</strong></p>
      <p>${message.replace(/\n/g, "<br>")}</p>
      <p>Best regards,<br>ProjectFlow Team</p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "We received your message - ProjectFlow",
      html: userConfirmation
    });

    console.log(`Contact message received from ${email}`);

    res.status(200).json({ 
      message: "Message sent successfully! We'll contact you soon." 
    });

  } catch (error) {
    console.error("Contact form error:", error.message);
    res.status(500).json({ 
      message: "Failed to send message. Please try again later." 
    });
  }
};
