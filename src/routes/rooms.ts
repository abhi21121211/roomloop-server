import express from "express";
import {
  createRoom,
  getPublicRooms,
  getRoomById,
  joinRoom,
  inviteUsers,
  getUserRooms,
  getAllRooms,
} from "../controllers/roomController";
import {
  getRoomMessages,
  createMessage,
} from "../controllers/messageController";
import {
  createReaction,
  getRoomReactions,
} from "../controllers/reactionController";
import { protect } from "../middleware/auth";

const router = express.Router();

// Protect all routes
router.use(protect);

// Room routes - IMPORTANT: Specific routes must be defined BEFORE parameterized routes (like /:id)
// Otherwise Express will try to interpret "/all" as a room ID
router.post("/", createRoom);
router.get("/public", getPublicRooms);
router.get("/user", getUserRooms);
router.get("/all", getAllRooms);
router.get("/:id", getRoomById);
router.post("/:roomId/join", joinRoom);
router.post("/:roomId/invite", inviteUsers);

// Message routes
router.get("/:roomId/messages", getRoomMessages);
router.post("/:roomId/messages", createMessage);

// Reaction routes
router.get("/:roomId/reactions", getRoomReactions);
router.post("/:roomId/reactions", createReaction);

export default router;
