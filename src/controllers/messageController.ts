import { Request, Response } from "express";
import Message from "../models/Message";
import Room, { RoomType } from "../models/Room";
import { IUser } from "../models/User";
<<<<<<< HEAD
import { io } from "../index";
=======
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

// Get messages for a room
export const getRoomMessages = async (
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

    // For private rooms, check if user is authorized
    if (room.roomType === RoomType.PRIVATE) {
      const isCreator = room.creator.toString() === user._id.toString();
      const isParticipant = room.participants.some(
        (participant) => participant.toString() === user._id.toString()
      );
      const isInvited = room.invitedUsers.some(
        (invited) => invited.toString() === user._id.toString()
      );

      if (!isCreator && !isParticipant && !isInvited) {
        res.status(403).json({
          success: false,
          message: "Not authorized to view messages in this room",
        });
        return;
      }
    }

    // Get messages for the room
    const messages = await Message.find({ room: roomId })
      .populate("sender", "username")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Get room messages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};

// Create a new message
export const createMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
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

    // Check if room is live
    if (room.status !== "live") {
      res.status(400).json({
        success: false,
        message: "Cannot send messages to a room that is not live",
      });
      return;
    }

    // Check if user is a participant or the creator
    const isParticipant = room.participants.some(
      (participant) => participant.toString() === user._id.toString()
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

        console.log(`Auto-joined user ${user._id} to room ${roomId}`);
      } else {
        res.status(403).json({
          success: false,
          message: "You must join the room to send messages",
        });
        return;
      }
    }

    // Create new message
    const message = new Message({
      content,
      sender: user._id,
      room: roomId,
    });

    await message.save();

    // Populate sender info for the response
    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "username"
    );

<<<<<<< HEAD
    // Emit socket event to all users in the room
    io.to(roomId).emit("receive_message", {
      roomId: roomId,
      message: populatedMessage,
      senderId: user._id.toString(), // Include sender ID for duplicate detection
    });

    console.log(
      `Message saved and broadcasted to room ${roomId}:`,
      populatedMessage
    );

=======
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create message",
    });
  }
};
