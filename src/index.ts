import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
<<<<<<< HEAD
import morgan from "morgan";
import compression from "compression";
import User from "./models/User";
import logger, { httpLogStream, loggerHelpers } from "./utils/logger";
import { connectDatabase } from "./config/database";
import cacheService from "./services/cache";
=======
import User from "./models/User";
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import userRoutes from "./routes/users";
<<<<<<< HEAD
import aiRoutes from "./routes/ai";
=======
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

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

<<<<<<< HEAD
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
=======
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: isProduction ? CORS_ORIGIN : "*", // In production, restrict to specific origin
    credentials: true,
  })
);

// Connect to MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/roomloop";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(
      `Connected to MongoDB (${
        isProduction ? "production" : "development"
      } mode)`
    );
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);
<<<<<<< HEAD
app.use("/api/ai", aiRoutes);
=======
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875

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
<<<<<<< HEAD
    loggerHelpers.logError(err, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    });

=======
    console.error("Server error:", err);
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
    res.status(err.status || 500).json({
      success: false,
      message: isProduction ? "Server error" : err.message,
      stack: isProduction ? undefined : err.stack,
    });
  }
);

<<<<<<< HEAD
// Socket.IO connection handling with enhanced performance
=======
// Socket.IO connection handling
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
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

<<<<<<< HEAD
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
=======
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Only log socket handshake in development mode
  if (!isProduction) {
    console.log("Socket handshake:", socket.handshake.address);
  }

<<<<<<< HEAD
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
=======
  // Join a room
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);

    // Confirm room joined back to the client
    socket.emit("room_joined", { roomId, status: "success" });
  });

  // Leave a room
  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room: ${roomId}`);

    // Confirm room left back to the client
    socket.emit("room_left", { roomId, status: "success" });
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
  });

  // Handle chat messages
  socket.on("send_message", (data) => {
<<<<<<< HEAD
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
=======
    console.log("Message received:", data);

    // Make sure we're sending consistent format for the message
    // This ensures both roomId and message object are present
    const messageData = {
      roomId: data.roomId,
      message: data.message,
    };

    // Broadcast to everyone in the room including the sender
    io.to(data.roomId).emit("receive_message", messageData);

    // Also emit a debug event just for testing
    socket.emit("message_sent_confirmation", {
      status: "success",
      message: "Message sent to room: " + data.roomId,
    });
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
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

<<<<<<< HEAD
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
=======
  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Start server
server.listen(PORT, () => {
<<<<<<< HEAD
  logger.info("Server started", {
    port: PORT,
    environment: NODE_ENV,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
  logger.info("Socket.IO server ready to accept connections");
=======
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`Socket.IO server is ready to accept connections`);
>>>>>>> 1c655bd80e36278e4c80a11b747c74f161606875
});
