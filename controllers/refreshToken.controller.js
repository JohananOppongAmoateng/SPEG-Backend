import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";

export const refreshToken = async (req, res) => {
    try {
      const refreshToken = req.cookies.token;
  
      // Better error handling for no token
      if (!refreshToken) {
        console.log("No refresh token in cookies");
        return res.status(403).json({
          message: "No refresh token provided",
        });
      }
  
      // Add a small delay to help with race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
  
      // Decode token first to get user ID
      try {
        const decoded = await new Promise((resolve, reject) => {
          jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            (err, decoded) => {
              if (err) reject(err);
              resolve(decoded);
            }
          );
        });
  
        // Find user by ID from decoded token
        const user = await prisma.user.findUnique({ where : { id: decoded.id}});
  
        if (!user) {
          console.log("User not found for ID:", decoded.id);
          return res.status(403).json({
            message: "User not found",
          });
        }
  
        // If the token is valid but doesn't match what's stored, 
        // it might be a race condition where another request just updated it
        if (user.refreshToken !== refreshToken) {
          console.log("Refresh token doesn't match stored token - possible race condition");
          
          // Verify the token is still valid and for this user
          try {
            const tokenUser = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            if (tokenUser.id === user.id.toString()) {
              // Token is valid for this user, but not the latest one
              // This could happen in race conditions
              console.log("Valid token for user, but not latest - possible race condition");
              
              // Create token data
              const tokenData = {
                user: user.firstName,
                email: user.email,
                id: user.id,
                role: user.role,
              };
  
              // Generate new access token but keep the refresh token the same
              const accessToken = jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
              });
  
              console.log("Generated new access token without changing refresh token");
              
              // Send back just the access token without changing the refresh token
              return res.status(200).json({
                success: true,
                accessToken,
              });
            }
          } catch (err) {
            // If the token is invalid even after this check, reject it
            console.log("Token verification failed in race condition handling:", err.message);
          }
          
          // If we're here, the token is truly invalid
          return res.status(403).json({
            message: "Invalid refresh token",
          });
        }
  
        // Create token data
        const tokenData = {
          user: user.firstName,
          email: user.email,
          id: user.id,
          role: user.role,
        };
  
        // Generate new tokens
        const accessToken = jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
  
        const newRefreshToken = jwt.sign(
          tokenData,
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: "30d" }
        );
  
        // Update user's refresh token
        user.refreshToken = newRefreshToken;
        await user.save();
        
        // Set cookie
        res.cookie("token", newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: "/",
        });
  
        // Send response
        return res.status(200).json({
          success: true,
          accessToken,
        });
      } catch (err) {
        // Handle JWT verification errors
        console.log("JWT verification failed:", err.message);
        return res.status(403).json({
          message: "Invalid or expired refresh token",
          error: err.message,
        });
      }
    } catch (err) {
      // Handle other errors
      console.log("Server error in refresh token:", err.message);
      return res.status(500).json({
        message: "Server error",
        error: err.message,
      });
    }
  };