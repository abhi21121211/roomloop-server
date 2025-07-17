import { Request, Response } from "express";
import aiService from "../services/aiService";
import Room from "../models/Room";
import Message from "../models/Message";
import User, { IUser } from "../models/User";

export const getAIStatus = async (req: Request, res: Response) => {
  try {
    const isAvailable = aiService.isServiceAvailable();
    res.json({
      success: true,
      data: {
        available: isAvailable,
        features: isAvailable
          ? [
              "chat_assistant",
              "content_moderation",
              "room_suggestions",
              "room_summaries",
              "smart_notifications",
            ]
          : [],
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get AI status",
    });
  }
};

export const chatAssistant = async (req: Request, res: Response) => {
  try {
    const { message, roomId, conversationHistory = [] } = req.body;
    const user = req.user as IUser;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // Get room context with detailed information
    const room = await Room.findById(roomId).populate("creator", "username");
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      });
    }

    // Check if user is authorized to use AI in this room
    const isCreator = room.creator._id.toString() === user._id.toString();
    const isParticipant = room.participants.some(
      (participant) => participant.toString() === user._id.toString()
    );
    const isInvited = room.invitedUsers.some(
      (invited) => invited.toString() === user._id.toString()
    );

    // Allow AI access for creator, participants, and invited users
    if (!isCreator && !isParticipant && !isInvited) {
      return res.status(403).json({
        success: false,
        error: "You must be a participant in this room to use AI features",
      });
    }

    // Get recent messages for context
    const recentMessages = await Message.find({ room: roomId })
      .populate("sender", "username")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get participant count
    const participantCount = room.participants ? room.participants.length : 0;

    // Helper function to safely get username
    const getUsername = (user: any): string => {
      if (user && typeof user === "object" && "username" in user) {
        return user.username;
      }
      return "Unknown";
    };

    // Build comprehensive room context
    const roomContext = `
Room: ${room.title || "Untitled Room"}
Description: ${room.description || "No description provided"}
Type: ${room.roomType || "unknown"} (${room.status || "unknown"})
Host: ${getUsername(room.creator)}
Participants: ${participantCount} people
Tags: ${room.tags && room.tags.length > 0 ? room.tags.join(", ") : "No tags"}
Start Time: ${
      room.startTime
        ? new Date(room.startTime).toLocaleString()
        : "Not scheduled"
    }
End Time: ${
      room.endTime ? new Date(room.endTime).toLocaleString() : "Not scheduled"
    }

Recent Discussion: ${
      recentMessages.length > 0
        ? recentMessages
            .reverse()
            .map((msg) => `${getUsername(msg.sender)}: ${msg.content}`)
            .join(" | ")
        : "No recent messages yet"
    }
    `.trim();

    console.log("AI Request Debug:");
    console.log("Message:", message);
    console.log("Room Context:", roomContext);
    console.log("Conversation History:", conversationHistory);

    const response = await aiService.chatAssistant(
      message,
      roomContext,
      conversationHistory
    );

    console.log("AI Response:", response);

    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get AI response",
    });
  }
};

export const moderateContent = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Content is required",
      });
    }

    const result = await aiService.moderateContent(content);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to moderate content",
    });
  }
};

export const suggestRooms = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // Get user and their history
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get user's room history
    const userHistory = await Room.find({
      $or: [{ creator: userId }, { participants: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get available rooms
    const availableRooms = await Room.find({
      status: "scheduled",
      $or: [
        { roomType: "public" },
        { creator: userId },
        { invitedUsers: userId },
      ],
    }).limit(20);

    const suggestions = await aiService.suggestRooms(
      user,
      availableRooms,
      userHistory
    );

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get room suggestions",
    });
  }
};

export const generateRoomSummary = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // Get room and messages
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      });
    }

    const messages = await Message.find({ room: roomId })
      .populate("sender", "username")
      .sort({ createdAt: 1 });

    const participants = await User.find({
      _id: { $in: room.participants },
    });

    const summary = await aiService.generateRoomSummary(
      messages,
      room,
      participants
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate room summary",
    });
  }
};

export const generateSmartNotification = async (
  req: Request,
  res: Response
) => {
  try {
    const { event, context } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const notification = await aiService.generateSmartNotification(
      user,
      event,
      context
    );

    res.json({
      success: true,
      data: { notification },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate notification",
    });
  }
};
