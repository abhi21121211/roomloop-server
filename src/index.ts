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
      // Leave all previous rooms
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join the new room
      socket.join(roomId);

      // Track user in room cache
      await cacheService.addRoomParticipant(roomId, (socket as any).user.id);

      // Notify other users in the room
      socket.to(roomId).emit("user_joined_room", {
        userId: (socket as any).user.id,
        username: (socket as any).user.username,
        timestamp: new Date().toISOString(),
      });

      loggerHelpers.logSocketEvent(
        "user_joined_room",
        socket.id,
        (socket as any).user.id,
        roomId
      );

      console.log(
        `User ${(socket as any).user.username} joined room ${roomId}`
      );
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "join_room",
        socketId: socket.id,
        roomId,
      });
    }
  });

  // Leave a room
  socket.on("leave_room", async (roomId) => {
    try {
      socket.leave(roomId);

      // Remove user from room cache
      await cacheService.removeRoomParticipant(roomId, (socket as any).user.id);

      // Notify other users in the room
      socket.to(roomId).emit("user_left_room", {
        userId: (socket as any).user.id,
        username: (socket as any).user.username,
        timestamp: new Date().toISOString(),
      });

      loggerHelpers.logSocketEvent(
        "user_left_room",
        socket.id,
        (socket as any).user.id,
        roomId
      );

      console.log(`User ${(socket as any).user.username} left room ${roomId}`);
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "leave_room",
        socketId: socket.id,
        roomId,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    try {
      // Remove user from all rooms
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        if (roomId !== socket.id) {
          await cacheService.removeRoomParticipant(
            roomId,
            (socket as any).user?.id
          );
          socket.to(roomId).emit("user_left_room", {
            userId: (socket as any).user?.id,
            username: (socket as any).user?.username,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Remove user from online cache
      if ((socket as any).user?.id) {
        await cacheService.removeOnlineUser((socket as any).user.id);
      }

      loggerHelpers.logSocketEvent(
        "user_disconnected",
        socket.id,
        (socket as any).user?.id
      );

      console.log("User disconnected:", socket.id);
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "disconnect",
        socketId: socket.id,
      });
    }
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 RoomLoop Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`🚀 RoomLoop Server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});
