import { Request, Response } from "express";
import Room, { IRoom, RoomType } from "../models/Room";
import User, { IUser } from "../models/User";
import mongoose from "mongoose";

// Generate a random room code
const generateRoomCode = (): string => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Create a new room
export const createRoom = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      title,
      description,
      roomType,
      startTime,
      endTime,
      maxParticipants,
      tags,
    } = req.body;
    const user = req.user as IUser;

    // Generate a unique room code
    let code = generateRoomCode();
    let codeExists = await Room.findOne({ code });

    // Keep generating until we have a unique code
    while (codeExists) {
      code = generateRoomCode();
      codeExists = await Room.findOne({ code });
    }

    // Create room
    const room = new Room({
      title,
      description,
      roomType,
      startTime,
      endTime,
      maxParticipants: maxParticipants || null,
      creator: user._id,
      participants: [user._id], // Creator automatically joins
      invitedUsers: [],
      tags: tags || [],
      code,
    });

    await room.save();

    // Add room to user's created rooms
    await User.findByIdAndUpdate(user._id, {
      $push: { createdRooms: room._id, joinedRooms: room._id },
    });

    res.status(201).json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create room",
    });
  }
};

// Get all public rooms (for explore page)
export const getPublicRooms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rooms = await Room.find({
      roomType: RoomType.PUBLIC,
      status: { $ne: "closed" }, // Not closed rooms
    })
      .populate("creator", "username")
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    console.error("Get public rooms error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public rooms",
    });
  }
};

// Get room by ID
export const getRoomById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const roomId = req.params.id;
    const user = req.user as IUser;

    const room = await Room.findById(roomId)
      .populate("creator", "username")
      .populate("participants", "username")
      .populate("invitedUsers", "username");

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    // For private rooms, check if user is creator or invited
    if (room.roomType === RoomType.PRIVATE) {
      const isCreator = room.creator._id.toString() === user._id.toString();
      const isInvited = room.invitedUsers.some(
        (invitedUser) => invitedUser._id.toString() === user._id.toString()
      );
      const isParticipant = room.participants.some(
        (participant) => participant._id.toString() === user._id.toString()
      );

      if (!isCreator && !isInvited && !isParticipant) {
        res.status(403).json({
          success: false,
          message: "Not authorized to access this room",
        });
        return;
      }
    }

    // Update room status based on current time
    room.updateStatus();
    await room.save();

    res.status(200).json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch room",
    });
  }
};

// Join a room
export const joinRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    const user = req.user as IUser;

    const room = await Room.findById(roomId);

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    // Check if room is private
    if (room.roomType === RoomType.PRIVATE) {
      const isInvited = room.invitedUsers.some(
        (invitedId) => invitedId.toString() === user._id.toString()
      );

      if (!isInvited && room.creator.toString() !== user._id.toString()) {
        res.status(403).json({
          success: false,
          message: "Not invited to this private room",
        });
        return;
      }
    }

    // Check if room is at capacity
    if (
      room.maxParticipants &&
      room.participants.length >= room.maxParticipants
    ) {
      res.status(400).json({
        success: false,
        message: "Room is at maximum capacity",
      });
      return;
    }

    // Check if user is already a participant
    const isParticipant = room.participants.some(
      (participantId) => participantId.toString() === user._id.toString()
    );

    if (isParticipant) {
      res.status(400).json({
        success: false,
        message: "Already joined this room",
      });
      return;
    }

    // Add user to participants
    await Room.findByIdAndUpdate(roomId, {
      $push: { participants: user._id },
      $pull: { invitedUsers: user._id }, // Remove from invited if they were invited
    });

    // Add room to user's joined rooms
    await User.findByIdAndUpdate(user._id, {
      $push: { joinedRooms: room._id },
      $pull: { invitedToRooms: room._id },
    });

    res.status(200).json({
      success: true,
      message: "Successfully joined room",
    });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join room",
    });
  }
};

// Invite users to a room
export const inviteUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { usernames } = req.body; // Array of usernames to invite
    const user = req.user as IUser;

    const room = await Room.findById(roomId);

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    // Check if user is the room creator
    if (room.creator.toString() !== user._id.toString()) {
      res.status(403).json({
        success: false,
        message: "Only the room creator can invite users",
      });
      return;
    }

    // Find users by usernames
    const usersToInvite = await User.find({ username: { $in: usernames } });

    if (usersToInvite.length === 0) {
      res.status(404).json({
        success: false,
        message: "No users found with the provided usernames",
      });
      return;
    }

    const userIds = usersToInvite.map((user) => user._id);

    // Add users to room's invited users
    await Room.findByIdAndUpdate(roomId, {
      $addToSet: { invitedUsers: { $each: userIds } },
    });

    // Add room to each user's invitedToRooms
    for (const userId of userIds) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { invitedToRooms: room._id },
      });
    }

    res.status(200).json({
      success: true,
      message: "Users invited successfully",
      invitedUsers: usersToInvite.map((user) => ({
        id: user._id,
        username: user.username,
      })),
    });
  } catch (error) {
    console.error("Invite users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to invite users",
    });
  }
};

// Get user's rooms (created, joined, and invited)
export const getUserRooms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user as IUser;

    // Populate user with their rooms
    const populatedUser = await User.findById(user._id)
      .populate({
        path: "createdRooms",
        populate: { path: "creator", select: "username" },
      })
      .populate({
        path: "joinedRooms",
        populate: { path: "creator", select: "username" },
      })
      .populate({
        path: "invitedToRooms",
        populate: { path: "creator", select: "username" },
      });

    if (!populatedUser) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Update status for all rooms
    const updateRoom = async (room: IRoom) => {
      room.updateStatus();
      await room.save();
      return room;
    };

    // Update the status of all rooms
    const createdRooms = await Promise.all(
      (populatedUser.createdRooms as unknown as IRoom[]).map(updateRoom)
    );

    const joinedRooms = await Promise.all(
      (populatedUser.joinedRooms as unknown as IRoom[]).map(updateRoom)
    );

    const invitedToRooms = await Promise.all(
      (populatedUser.invitedToRooms as unknown as IRoom[]).map(updateRoom)
    );

    // Group rooms by status
    const upcoming = [...createdRooms, ...joinedRooms, ...invitedToRooms]
      .filter((room) => room.status === "scheduled")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const live = [...createdRooms, ...joinedRooms, ...invitedToRooms]
      .filter((room) => room.status === "live")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const past = [...createdRooms, ...joinedRooms]
      .filter((room) => room.status === "closed")
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

    const invites = invitedToRooms
      .filter((room) => room.status !== "closed")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    res.status(200).json({
      success: true,
      rooms: {
        upcoming,
        live,
        past,
        invites,
      },
    });
  } catch (error) {
    console.error("Get user rooms error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user rooms",
    });
  }
};
