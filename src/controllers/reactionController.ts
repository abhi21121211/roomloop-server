import { Request, Response } from "express";
import Reaction from "../models/Reaction";
import Room from "../models/Room";
import { IUser } from "../models/User";

// Create a reaction
export const createReaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { emoji } = req.body;
    const user = req.user as IUser;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    // Check if user is a participant or creator
    const isParticipant = room.participants.some(
      (participantId) => participantId.toString() === user._id.toString()
    );

    const isCreator = room.creator.toString() === user._id.toString();

    if (!isParticipant && !isCreator) {
      // If not a participant yet, try to auto-join if user is invited
      const isInvited = room.invitedUsers.some(
        (invited) => invited.toString() === user._id.toString()
      );

      if (isInvited) {
        // Auto-join the room for invited users
        await Room.findByIdAndUpdate(roomId, {
          $push: { participants: user._id },
          $pull: { invitedUsers: user._id },
        });

        console.log(
          `Auto-joined user ${user._id} to room ${roomId} for reaction`
        );
      } else {
        res.status(403).json({
          success: false,
          message: "You must join the room to send reactions",
        });
        return;
      }
    }

    // Check if room is live
    if (room.status !== "live") {
      res.status(400).json({
        success: false,
        message: "Cannot send reactions to a room that is not live",
      });
      return;
    }

    // Create reaction
    const reaction = new Reaction({
      emoji,
      user: user._id,
      room: roomId,
    });

    await reaction.save();

    // Populate user info
    const populatedReaction = await Reaction.findById(reaction._id).populate(
      "user",
      "username"
    );

    res.status(201).json({
      success: true,
      reaction: populatedReaction,
    });
  } catch (error) {
    console.error("Create reaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reaction",
    });
  }
};

// Get recent reactions for a room
export const getRoomReactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const user = req.user as IUser;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    // Check if user is authorized to view the room
    const isParticipant = room.participants.some(
      (participantId) => participantId.toString() === user._id.toString()
    );

    const isCreator = room.creator.toString() === user._id.toString();

    const isInvited = room.invitedUsers.some(
      (invited) => invited.toString() === user._id.toString()
    );

    if (!isParticipant && !isCreator && !isInvited) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to view this room's reactions",
      });
      return;
    }

    // Get recent reactions (last 100)
    const reactions = await Reaction.find({ room: roomId })
      .populate("user", "username")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: reactions.length,
      reactions: reactions.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error("Get room reactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reactions",
    });
  }
};
