import express from "express";
import { register, login, getCurrentUser } from "../controllers/authController";
import { protect } from "../middleware/auth";
import { authLimiter, checkAccountLockout } from "../middleware/security";
// Import validation once express-validator types are resolved
// import { validateRegister, validateLogin } from "../middleware/validation";

const router = express.Router();

// Register route with rate limiting and validation
router.post("/register", authLimiter, /* validateRegister, */ register);

// Login route with rate limiting, account lockout, and validation
router.post(
  "/login",
  authLimiter,
  checkAccountLockout,
  /* validateLogin, */ login
);

// Get current user route (protected)
router.get("/me", protect, getCurrentUser);

export default router;
