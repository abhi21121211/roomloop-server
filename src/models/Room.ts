import mongoose, { Document, Schema } from "mongoose";

export enum RoomStatus {
  SCHEDULED = "scheduled",
  LIVE = "live",
  CLOSED = "closed",
}

export enum RoomType {
  PUBLIC = "public",
  PRIVATE = "private",
}

export interface IRoom extends Document {
  title: string;
  description: string;
  roomType: RoomType;
  status: RoomStatus;
  creator: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  maxParticipants?: number;
  participants: mongoose.Types.ObjectId[];
  invitedUsers: mongoose.Types.ObjectId[];
  tags: string[];
  code: string;
  createdAt: Date;
  updatedAt: Date;
  updateStatus(): void;
}

const RoomSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    roomType: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.PUBLIC,
    },
    status: {
      type: String,
      enum: Object.values(RoomStatus),
      default: RoomStatus.SCHEDULED,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    maxParticipants: {
      type: Number,
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    invitedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    code: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to update room status based on time
RoomSchema.methods.updateStatus = function (): void {
  const now = new Date();

  if (now >= this.startTime && now < this.endTime) {
    this.status = RoomStatus.LIVE;
  } else if (now >= this.endTime) {
    this.status = RoomStatus.CLOSED;
  } else {
    this.status = RoomStatus.SCHEDULED;
  }
};

// Middleware to update status before saving
RoomSchema.pre<IRoom>("save", function (next) {
  this.updateStatus();
  next();
});

// Database indexes for improved query performance
RoomSchema.index({ creator: 1 }); // For fetching user's created rooms
RoomSchema.index({ participants: 1 }); // For fetching user's joined rooms
RoomSchema.index({ invitedUsers: 1 }); // For fetching user's invited rooms
RoomSchema.index({ roomType: 1, status: 1 }); // For public/private room queries with status
RoomSchema.index({ startTime: 1 }); // For sorting by start time
RoomSchema.index({ endTime: 1 }); // For sorting by end time
RoomSchema.index({ status: 1, startTime: 1 }); // Compound index for status + time queries
RoomSchema.index({ roomType: 1, startTime: 1 }); // Compound index for type + time queries
RoomSchema.index({ code: 1 }, { unique: true }); // Unique index for room codes
RoomSchema.index({ title: "text", description: "text", tags: "text" }); // Text search index
RoomSchema.index({ createdAt: 1 }); // For sorting by creation date
RoomSchema.index({
  creator: 1,
  roomType: 1,
  status: 1,
}); // Compound index for creator's room management

export default mongoose.model<IRoom>("Room", RoomSchema);
