import express from "express";
import { protect } from "../middleware/auth";

const router = express.Router();

// Protect all routes
router.use(protect);

// Basic user route for future expansion
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "User routes working",
  });
});

export default router;
