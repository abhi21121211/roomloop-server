import mongoose, { Document, Schema } from "mongoose";

export interface IReaction extends Document {
  emoji: string;
  user: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ReactionSchema: Schema = new Schema(
  {
    emoji: {
      type: String,
      required: true,
    },
    user: {
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
ReactionSchema.index({ room: 1, createdAt: -1 }); // For fetching room reactions sorted by time
ReactionSchema.index({ user: 1, createdAt: -1 }); // For fetching user's reactions
ReactionSchema.index({ room: 1, user: 1, emoji: 1 }); // For preventing duplicate reactions
ReactionSchema.index({ room: 1, emoji: 1 }); // For grouping reactions by emoji in rooms

export default mongoose.model<IReaction>("Reaction", ReactionSchema);
