import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { recordLoginAttempt } from "../middleware/security";
import { loggerHelpers } from "../utils/logger";

// Generate JWT token
const generateToken = (userId: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET || "roomloop_secret_key";
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
};

// Register a new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: "Email or username already in use",
      });
      return;
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Log successful registration
    loggerHelpers.logUserAction(user._id, "register", {
      username: user.username,
      email: user.email,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    loggerHelpers.logError(error as Error, {
      action: "register",
      ip: req.ip,
      body: { username: req.body.username, email: req.body.email },
    });
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password } = req.body;

    // Check if user exists (by email or username)
    const user = await User.findOne({
      $or: [{ email: login }, { username: login }],
    });

    const identifier = login.toLowerCase();

    if (!user) {
      recordLoginAttempt(identifier, false);
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      recordLoginAttempt(identifier, false);
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Record successful login
    recordLoginAttempt(identifier, true);

    // Log successful login
    loggerHelpers.logUserAction(user._id, "login", {
      username: user.username,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    loggerHelpers.logError(error as Error, {
      action: "login",
      ip: req.ip,
      login: req.body.login,
    });
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// Get current user
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // User is already attached to the request by auth middleware
    const user = req.user as IUser;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdRooms: user.createdRooms,
        joinedRooms: user.joinedRooms,
        invitedToRooms: user.invitedToRooms,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user data",
    });
  }
};
