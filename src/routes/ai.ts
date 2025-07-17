import express from "express";
import {
  getAIStatus,
  chatAssistant,
  moderateContent,
  suggestRooms,
  generateRoomSummary,
  generateSmartNotification,
} from "../controllers/aiController";
import { protect } from "../middleware/auth";

const router = express.Router();

// Get AI service status
router.get("/status", getAIStatus);

// AI Chat Assistant
router.post("/chat", protect, chatAssistant);

// Content Moderation
router.post("/moderate", protect, moderateContent);

// Room Suggestions
router.get("/suggestions", protect, suggestRooms);

// Generate Room Summary
router.get("/summary/:roomId", protect, generateRoomSummary);

// Generate Smart Notifications
router.post("/notifications", protect, generateSmartNotification);

export default router;
