import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "./models/User";

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import userRoutes from "./routes/users";

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);

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
    console.error("Server error:", err);
    res.status(err.status || 500).json({
      success: false,
      message: isProduction ? "Server error" : err.message,
      stack: isProduction ? undefined : err.stack,
    });
  }
);

// Socket.IO connection handling
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

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Only log socket handshake in development mode
  if (!isProduction) {
    console.log("Socket handshake:", socket.handshake.address);
  }

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
  });

  // Handle chat messages
  socket.on("send_message", (data) => {
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

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`Socket.IO server is ready to accept connections`);
});
