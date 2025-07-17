import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import compression from "compression";
import User from "./models/User";
import logger, { httpLogStream, loggerHelpers } from "./utils/logger";
import { connectDatabase } from "./config/database";
import cacheService from "./services/cache";

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import userRoutes from "./routes/users";
import aiRoutes from "./routes/ai";

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Create HTTP server
const server = http.createServer(app);

// Get CORS origin from environment or use default
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: isProduction ? CORS_ORIGIN : "*", // In production, restrict to specific origin
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Export io for use in other files
export { io };

// Security middleware
import {
  securityHeaders,
  generalLimiter,
  sanitizeInput,
  corsOptions,
} from "./middleware/security";

// Apply security headers
app.use(securityHeaders);

// Apply rate limiting
app.use(generalLimiter);

// HTTP request logging
app.use(morgan("combined", { stream: httpLogStream }));

// Response compression (gzip/brotli)
app.use(
  compression({
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers["x-no-compression"]) {
        return false;
      }
      // Use compression for all other requests
      return compression.filter(req, res);
    },
  })
);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply input sanitization
app.use(sanitizeInput);

// CORS with proper configuration
app.use(cors(corsOptions));

// Connect to MongoDB with enhanced configuration
connectDatabase();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ai", aiRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "RoomLoop API is running",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for monitoring services
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Generic error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    loggerHelpers.logError(err, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    });

    res.status(err.status || 500).json({
      success: false,
      message: isProduction ? "Server error" : err.message,
      stack: isProduction ? undefined : err.stack,
    });
  }
);

// Socket.IO connection handling with enhanced performance
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default_secret"
    ) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("User not found"));
    }

    // Associate socket with user ID for direct messaging
    socket.join(user._id.toString());

    // Store user data in socket for later use
    (socket as any).user = {
      id: user._id,
      username: user.username,
    };

    // Track online user in cache
    await cacheService.setOnlineUser(user._id.toString(), socket.id);

    loggerHelpers.logSocketEvent(
      "user_connected",
      socket.id,
      user._id.toString()
    );

    next();
  } catch (error) {
    loggerHelpers.logError(error as Error, { operation: "socket_auth" });
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Only log socket handshake in development mode
  if (!isProduction) {
    console.log("Socket handshake:", socket.handshake.address);
  }

  // Join a room with enhanced tracking
  socket.on("join_room", async (roomId) => {
    try {
      socket.join(roomId);

      // Track room participant in cache
      if ((socket as any).user?.id) {
        await cacheService.addRoomParticipant(roomId, (socket as any).user.id);
      }

      loggerHelpers.logSocketEvent(
        "room_joined",
        socket.id,
        (socket as any).user?.id,
        roomId
      );

      // Confirm room joined back to the client
      socket.emit("room_joined", { roomId, status: "success" });

      // Notify other users in the room
      socket.to(roomId).emit("user_joined_room", {
        userId: (socket as any).user?.id,
        username: (socket as any).user?.username,
        roomId,
      });
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "socket_join_room",
        roomId,
        socketId: socket.id,
      });
    }
  });

  // Leave a room with enhanced tracking
  socket.on("leave_room", async (roomId) => {
    try {
      socket.leave(roomId);

      // Remove from room participants cache
      if ((socket as any).user?.id) {
        await cacheService.removeRoomParticipant(
          roomId,
          (socket as any).user.id
        );
      }

      loggerHelpers.logSocketEvent(
        "room_left",
        socket.id,
        (socket as any).user?.id,
        roomId
      );

      // Confirm room left back to the client
      socket.emit("room_left", { roomId, status: "success" });

      // Notify other users in the room
      socket.to(roomId).emit("user_left_room", {
        userId: (socket as any).user?.id,
        username: (socket as any).user?.username,
        roomId,
      });
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "socket_leave_room",
        roomId,
        socketId: socket.id,
      });
    }
  });

  // Handle chat messages
  socket.on("send_message", (data) => {
    console.log("Message received via socket:", data);

    // Extract the message and roomId
    const message = data.message || data;
    const roomId =
      data.roomId ||
      (message.room &&
        (typeof message.room === "string" ? message.room : message.room._id));

    if (!roomId) {
      console.error("No roomId found in message data");
      return;
    }

    // Broadcast the message to everyone in the room
    io.to(roomId).emit("receive_message", {
      roomId: roomId,
      message: message,
    });

    console.log(`Broadcasting message to room ${roomId}:`, message);
  });

  // Handle reactions
  socket.on("send_reaction", (data) => {
    console.log("Reaction received:", data);

    // Make sure we're sending consistent format for the reaction
    const reactionData = {
      roomId: data.roomId,
      reaction: {
        emoji: data.emoji,
        userId: data.userId,
        room: data.roomId,
        createdAt: new Date(),
      },
    };

    io.to(data.roomId).emit("receive_reaction", reactionData);
  });

  // Handle disconnection with cleanup
  socket.on("disconnect", async (reason) => {
    try {
      // Remove from online users cache
      if ((socket as any).user?.id) {
        await cacheService.removeOnlineUser((socket as any).user.id);
      }

      loggerHelpers.logSocketEvent(
        "user_disconnected",
        socket.id,
        (socket as any).user?.id,
        undefined,
        {
          reason,
        }
      );
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "socket_disconnect",
        socketId: socket.id,
      });
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info("Server started", {
    port: PORT,
    environment: NODE_ENV,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
  logger.info("Socket.IO server ready to accept connections");
});
