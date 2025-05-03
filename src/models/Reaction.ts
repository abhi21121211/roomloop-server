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

export default mongoose.model<IReaction>("Reaction", ReactionSchema);
