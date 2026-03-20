const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const sendEmail = async (to, otp, type = "verify") => {
  try {
    await transporter.verify();
    console.log("Email transporter ready");

    const isReset = type === "reset";

    const subject = isReset
      ? "Reset Your Password"
      : "Verify Your Account";

    const heading = isReset
      ? "Reset Your Password"
      : "Verify Your Account";

    const description = isReset
      ? "We received a request to reset the password for your ProjectFlow account. If you made this request, please use the OTP below to securely reset your password."
      : "Welcome to ProjectFlow! To ensure the security of your account, please verify your email address using the OTP provided below.";

    const buttonColor = isReset ? "#dc2626" : "#2563eb";
    const boxBg = isReset ? "#fee2e2" : "#eff6ff";
    const textColor = isReset ? "#dc2626" : "#2563eb";

    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${heading}</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); margin-top: 40px; margin-bottom: 40px; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 30px; text-align: center; }
        .header-reset { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); }
        .logo-text { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .content { padding: 40px 30px; text-align: center; }
        .icon-circle { width: 64px; height: 64px; background-color: ${boxBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: ${textColor}; font-size: 32px; font-weight: bold; }
        .title { color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
        .description { color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 30px; max-width: 480px; margin-left: auto; margin-right: auto; }
        .otp-box { background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; padding: 20px; display: inline-block; margin-bottom: 30px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: ${textColor}; margin: 0; }
        .warning { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; text-align: left; border-radius: 4px; font-size: 14px; color: #b45309; margin-bottom: 30px; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer-text { font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.5; }
        .social-links { margin-top: 15px; }
        .social-link { display: inline-block; margin: 0 10px; color: #9ca3af; text-decoration: none; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header ${isReset ? 'header-reset' : ''}">
          <h1 class="logo-text">ProjectFlow</h1>
        </div>
        
        <div class="content">
          <div class="title">${heading}</div>
          <p class="description">${description}</p>
          
          <div class="otp-box">
            <p class="otp-code">${otp}</p>
          </div>
          
          <div class="warning">
            <strong>Security Notice:</strong> This code will expire in 2 minutes. Do not share this code with anyone, including ProjectFlow support.
          </div>
          
          <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            &copy; ${new Date().getFullYear()} ProjectFlow. All rights reserved.<br>
            Made for high-performance teams.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
      from: `"ProjectFlow Security" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: `${heading} - Your OTP is ${otp}. It expires in 2 minutes.`,
      html: htmlTemplate
    });

    console.log(`${type.toUpperCase()} OTP email sent to ${to}`);

  } catch (error) {
    console.error("Email send failed:", error.message);
    throw error;
  }
};

module.exports = sendEmail;
