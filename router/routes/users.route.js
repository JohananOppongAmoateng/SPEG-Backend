import { Router } from "express";
import {
    userSignIn,
    userSignUp,
    adminVerify,
    getAllUsers,
    userDelete,
    userSignOut,
    forgotPwd,
    resetPwd,
    editDetails,
    getUserDetails,
    resendEmail,
    verifyUser,
    adminDelete,
    verifyAuth
} from "../../controllers/users.controller.js";
import { refreshToken } from "../../controllers/refreshToken.controller.js";
import { verifyRoles } from "../../middleware/verifyRoles.js";
import { verifyToken } from "../../middleware/verifyToken.js";
const router = Router();

// User Authentication Routes
router.post("/login", userSignIn);
router.get("/logout", userSignOut);
router.post("/signup", userSignUp);
router.get("/refresh_auth", refreshToken);
router.post("/resend-verification", resendEmail);
router.post("/verify_token", verifyToken, verifyAuth);

// Password Management
router.post("/forgotpwd", forgotPwd);
router.post("/resetpwd", resetPwd);
router.post("/verifytoken", verifyUser);

// User Managements
router.patch(
    "/:userId/adminverify",
    verifyToken,
    verifyRoles("admin"),
    adminVerify
);
router.delete(
    "/:userId/admindelete",
    verifyToken,
    verifyRoles("admin"),
    adminDelete
);
router.patch("/:userId/editDetails", editDetails);
router.get("/all", getAllUsers);
router.get("/profile", verifyToken, getUserDetails);
router.delete("/:userId", verifyToken, verifyRoles("admin"), userDelete);

export default router;
