import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendMail } from "../helpers/mailer.js";
import prisma from "../utils/prisma.js";

export async function userSignIn(req, res) {
    try {
        const { email, password } = req.body;

        // Validate request body
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify password
        const validPassword = await bcryptjs.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Incorrect password" });
        }


        if (user.emailVerified === false) {
            return res.status(403).json({
                message: "Please verify your email before signing in"
            });
        }

        // Prepare token data
        const tokenData = {
            user: user.firstName,
            email: user.email,
            id: user.id,
            role: user.role
        };

        // Generate tokens
        const accessToken = jwt.sign(
            tokenData,
            process.env.ACCESS_TOKEN_SECRET,
            {
                expiresIn: "1h"
            }
        );
        const refreshToken = jwt.sign(
            tokenData,
            process.env.REFRESH_TOKEN_SECRET,
            {
                expiresIn: "30d"
            }
        );

        // Save refresh token to database
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });

        // Set refresh token as a cookie
        res.cookie("token", refreshToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        console.log(refreshToken, "refreshToken");
        // Send response
        return res.status(200).json({
            success: true,
            message: "Login successful",
            accessToken
        });
    } catch (error) {
        console.error("Error during user sign-in:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function userSignUp(req, res) {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            farmName,
            farmLocation,
            telNumber,
            role
        } = req.body;

        if (role !== "admin") {
            if (
                !firstName ||
                !lastName ||
                !email ||
                !password ||
                !farmName ||
                !farmLocation ||
                !telNumber
            ) {
                return res.status(404).json({
                    message: "Necessary farmer information not provided"
                });
            }
        }

        const verifyEmail = await prisma.user.findUnique({
            where: { email }
        });

        if (verifyEmail) {
            return res.status(500).json({ message: "User already exists" });
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPwd = await bcryptjs.hash(password, salt);

        const newUserData =
            role !== "admin"
            ? {
                  firstName,
                  lastName,
                  password: hashedPwd,
                  telNumber,
                  farmName,
                  farmLocation,
                  email,
                  role
              }
            : { email, password: hashedPwd, role, firstName, lastName };

        // Save the user using Prisma
        const savedUser = await prisma.user.create({
            data: newUserData
        });

        console.log(savedUser.id, "id");
        // If email sent successfully, return success response

        try {
            // Send verification email with the saved user's ID
            await sendMail({
                email,
                emailType: "VERIFY",
                userId: savedUser.id
            });

            // If email sent successfully, return success response
            return res
                .status(200)
                .json({ message: "Sign-up successful", savedUser });
        } catch (error) {
            // Remove user if email sending fails  
            return res.status(500).json({
                message: "Failed to send verification email",
                error: error.message
            });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// resend email
export const resendEmail = async (req, res) => {
    try {
        // Parse email from the request body
        const { email } = req.body;

        // Find the user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // If user is not found, return 404
        if (!user) {
            return res
                .status(404)
                .json({ message: "User not found", success: false });
        }

        // Send verification email
        await sendMail({
            user: user.email,
            emailType: "VERIFY",
            userId: user._id
        });

        // If email sent successfully, return success response
        return res
            .status(200)
            .json({ message: "Resend successful", success: true });
    } catch (error) {
        // Handle errors and return failure response
        return res.status(500).json({
            message: "Failed to send verification email",
            error: error.message,
            success: false
        });
    }
};

// verifify by admin
export async function adminVerify(req, res) {
    try {
        const { userId } = req.params;
        const user = await prisma.user.update({
            where: { id: userId },
            data: { adminVerified: true }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function adminDelete(req, res) {
    try {
        const { userId } = req.params;
        const user = await prisma.user.delete({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            user,
            message: "User deleted successfully by admin"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// get all users

export async function getAllUsers(req, res) {
    try {
        const users = await prisma.user.findMany();

        return res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// delete a particular user from db
export async function userDelete(req, res) {
    try {
        const { userId } = req.params;
        const user = await prisma.user.delete({
            where: { id: userId }
            });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            user,
            message: "User deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// user signout here
export async function userSignOut(req, res) {
    try {
        const refreshToken = req.cookies.token;

        if (!refreshToken) {
            // If no token is present in the cookie
            return res.status(204).end(); // No Content
        }

        // Find the user with the given refresh token
        const user = await prisma.user.findFirst({
            where: { refreshToken }
        });
        if (user) {
            // Clear the refresh token from the database
            await prisma.user.update({
                where: { id: user.id },
                data: { refreshToken: "" }
            });
        }

        // Clear the cookie regardless of whether the user was found
        res.clearCookie("token", {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
            secure: process.env.NODE_ENV === "production"
        });

        return res.status(204).end(); // No Content
    } catch (error) {
        console.error("Error during logout:", error);
        return res.status(500).json({
            message: "An error occurred during logout",
            error: error.message
        });
    }
}

// forgot  pwd
export async function forgotPwd(req, res) {
    try {
        const { email, site } = req.body; // Access JSON data correctly

        // Validate the email
        if (!email) {
            return res.status(400).json({ message: "Please provide an email" });
        }

        const user = await prisma.user.findFirst({ where: { email } }); // Use Prisma to find the user by email

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Send password reset email
        await sendMail({ email, emailType: "RESET", userId: user._id, site });

        return res.status(200).json({
            message: "Password reset link sent to email",
            success: true
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// reset pwd
export async function resetPwd(req, res) {
    try {
        const { password, token } = req.body;
        const decodedToken = decodeURIComponent(token);

        // Confirm password and token are present
        if (!password || !token) {
            return res
                .status(401)
                .json({ message: "Please provide password and token" });
        }

        // Find user by the token
        const user = await prisma.user.findFirst({
            where: { forgotPasswordToken: decodedToken }
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid token." });
        }

        // Check if the token has expired
        if (user.forgotPasswordTokenExpiry < Date.now()) {
            return res.status(401).json({
                message:
                    "Token has expired. Please request a new password reset."
            });
        }

        // Compare the new password with the existing password
        const isPwdSame = await compare(password, user.password);
        if (isPwdSame) {
            return res.status(400).json({
                message: "Password already exists, please use a new one."
            });
        }

        // Hash the new password
        const salt = await genSalt(10);
        const hashedPwd = await hash(password, salt);

        // Update the user's password and clear the token fields
        await prisma.user.update({
            where: { id: user.id },
            data: {
            password: hashedPwd,
            forgotPasswordToken: null,
            forgotPasswordTokenExpiry: null
            }
        });

        return res.status(200).json({
            message: "Password changed successfully.",
            success: true
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "An error occurred.", error: error.message });
    }
}

export async function verifyUser(req, res) {
    try {
        const { token } = req.body;
        const decodedToken = decodeURIComponent(token);

        // Check if the token exists in the database
        const user = await prisma.user.findFirst({
            where: { verifyToken: decodedToken }
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid token."
            });
        }

        // Check if the token has expired
        if (user.verifyTokenExpiry < Date.now()) {
            return res.status(400).json({
                message:
                    "Token has expired. Please request a new verification link."
            });
        }

        // Mark user as verified and clear the token fields
        await prisma.user.update({
            where: { id: user.id },
            data: {
            isVerified: true,
            verifyToken: null,
            verifyTokenExpiry: null
            }
        });

        return res.status(200).json({
            message: "User email verification successful.",
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
}

export async function editDetails(req, res) {
    try {
        const { userId } = req.params;
        const {
            firstName,
            lastName,
            farmName,
            farmLocation,
            telNumber
        } = req.body;

        // Find the user by ID and update the specified fields
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
            firstName,
            lastName,
            farmName,
            farmLocation,
            telNumber
            }
        });

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User details updated successfully",
            user: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            message: "An error occurred while updating user details",
            error: error.message
        });
    }
}

export async function getUserDetails(req, res) {
    try {
        // Get the refresh token from the cookie
        const { id } = req.user;
        // Find the user by refresh token
        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Remove sensitive information before sending response
        const userDetails = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            farmName: user.farmName,
            farmLocation: user.farmLocation,
            telNumber: user.telNumber,
            role: user.role,
            adminVerified: user.adminVerified,
            isVerified: user.isVerified
        };

        return res.status(200).json({
            success: true,
            message: "User details retrieved successfully",
            user: userDetails
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
export async function verifyAuth(req, res) {
    try {
        // Get the refresh token from the cookie
        const { id, role } = req.user;
        // Find the user by refresh token
        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            role: role
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
