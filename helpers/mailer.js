import { createTransport } from "nodemailer";
import dotEnv from "dotenv";
dotEnv.config();
import smtpTransport from "nodemailer-smtp-transport";
import bcryptjs from "bcryptjs";
import prisma from "../utils/prisma.js";
import { v4 as uuidv4 } from 'uuid';

export async function sendMail({ email, emailType, userId, site }) {
  console.log(userId, "id from user");
  try {
    const hashedToken = await bcryptjs.hash(userId.toString(), 10);
    
    let user = "";
    const myUUID = uuidv4()
    const forgotPasswordToken = uuidv4()
    if (emailType === "VERIFY") {
      
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          verifyToken: myUUID,
          verifyTokenExpiry: new Date(Date.now() + 3600000), // 1 hour expiry
        },
      });

      if (!user) {
        throw new Error("User not found");
      }
    } else if (emailType === "RESET") {
      
      
      user = await  prisma.user.update({
        where: { id: userId },
        data: {
          forgotPasswordToken: forgotPasswordToken,
          forgotPasswordTokenExpiry: Date.now() + 3600000, // 1 hour expiry
        }
      });

      if (!user) {
        throw new Error("User not found");
      }
    }

    const transporter = createTransport(
      smtpTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
      })
    );

    const mailOptions = {
      from: "admin@spegpine.com",
      to: email,
      subject: `${
        emailType === "RESET" ? "Reset Your Password" : "Verify Your Email"
      }`,
      html: `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                  <div style="text-align: center; padding-bottom: 20px;">
                    <img src="https://spegpine.com/wp-content/uploads/2021/02/spegpine_logo.jpg" alt="SpegPine Logo" style="max-width: 120px; height: auto;">
                  </div>
                  <h2 style="color: #228B22; text-align: center; font-size: 24px; margin-bottom: 20px;">${
                    emailType === "RESET"
                      ? "Reset Your Password"
                      : "Verify Your Email"
                  }</h2>
                  <p style="font-size: 16px; line-height: 1.7; color: #555;">
                    Hello ${user?.firstName},
                  </p>
                  <p style="font-size: 16px; line-height: 1.7; color: #555;">
                    Please click the button below to ${
                      emailType === "RESET"
                        ? "reset your password"
                        : "verify your email"
                    }. This link will expire in 24 hours.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${site}/${
        emailType === "RESET" ? `resetpwd/${forgotPasswordToken}` : `verify/${myUUID}`
      }" style="display: inline-block; padding: 14px 28px; color: white; background-color: #228B22; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; transition: background-color 0.3s ease;">
                      ${
                        emailType === "RESET"
                          ? "Reset Password"
                          : "Verify Email"
                      }
                    </a>
                  </div>
                  <p style="font-size: 16px; line-height: 1.7; color: #555;">
                    If you did not request this, please ignore this email.
                  </p>
                  <p style="font-size: 16px; line-height: 1.7; color: #555;">
                    Thanks,<br>
                    The SpegPine Team
                  </p>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://spegpine.com" style="color: #228B22; text-decoration: none; font-size: 14px; font-weight: bold;">Visit our website</a>
                  </div>
                </div>
              `,
    };

    const mailResponse = await transporter.sendMail(mailOptions);

    return mailResponse;
  } catch (error) {
    throw new Error(error.message);
  }
}
