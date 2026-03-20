const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendContactEmail = async (name, email, message) => {

  if (!name || !email || !message) {
    throw new Error("Name, email, and message are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  
  await transporter.sendMail({
    from: `"ProjectFlow Contact" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `📩 New Contact Message from ${name} - ProjectFlow`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Message:</strong></p>
        <p style="background: #f3f4f6; padding: 15px; border-left: 4px solid #0d9488;">${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <small style="color: #6b7280;">ProjectFlow Contact System</small>
      </div>
    `,
    replyTo: email
  });

  // Send confirmation email to user
  await transporter.sendMail({
    from: `"ProjectFlow Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "We received your message - ProjectFlow",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0d9488;">Thank You for Contacting Us</h2>
        <p>Hi ${name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p><strong>Your Message:</strong></p>
        <p style="background: #f3f4f6; padding: 15px; border-left: 4px solid #0d9488;">${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p>Best regards,<br><strong>ProjectFlow Team</strong></p>
      </div>
    `
  });

  console.log(`Contact message sent successfully from ${email}`);
};

module.exports = sendContactEmail;

