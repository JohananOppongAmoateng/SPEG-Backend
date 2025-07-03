import jwt from "jsonwebtoken";

// Middleware to verify token
export async function verifyToken(req, res, next) {
    try {
        // Get the token from the Authorization header or cookie
        let token = req.headers.authorization;

        if (!token && req.cookies && req.cookies.accessToken) {
            token = `Bearer ${req.cookies.accessToken}`;
        }

        if (!token || !token.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided" });
        }

        token = token.split(" ")[1]; // Extract the token from "Bearer <token>"

        // Verify the token using jwt.verify
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: "Invalid token" });
            }

            // Attach user and role info to req object
            req.user = decoded;
            req.role = decoded.role;
            next();
        });
    } catch (error) {
        // If token verification fails, respond with an error
        res.status(401).json({ message: "Token verification failed" });
    }
}
