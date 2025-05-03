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

export default mongoose.model<IRoom>("Room", RoomSchema);
