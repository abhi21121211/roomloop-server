import mongoose, { Document, Schema } from "mongoose";

export interface IMessage extends Document {
  content: string;
  sender: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Database indexes for improved query performance
MessageSchema.index({ room: 1, createdAt: -1 }); // For fetching room messages sorted by time
MessageSchema.index({ sender: 1, createdAt: -1 }); // For fetching user's messages
MessageSchema.index({ room: 1, sender: 1 }); // For filtering messages by room and sender
MessageSchema.index({ createdAt: -1 }); // For sorting by creation date

export default mongoose.model<IMessage>("Message", MessageSchema);
