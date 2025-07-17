import express from "express";
import { register, login, getCurrentUser } from "../controllers/authController";
import { protect } from "../middleware/auth";
<<<<<<< HEAD
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
=======

const router = express.Router();

// Register route
router.post("/register", register);

// Login route
router.post("/login", login);
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

// Get current user route (protected)
router.get("/me", protect, getCurrentUser);

export default router;
