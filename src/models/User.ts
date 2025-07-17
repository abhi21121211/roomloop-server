import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  createdRooms: mongoose.Types.ObjectId[];
  joinedRooms: mongoose.Types.ObjectId[];
  invitedToRooms: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    createdRooms: [
      {
        type: Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
    joinedRooms: [
      {
        type: Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
    invitedToRooms: [
      {
        type: Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Database indexes for improved query performance
UserSchema.index({ email: 1 }, { unique: true }); // Unique index for email
UserSchema.index({ username: 1 }, { unique: true }); // Unique index for username
UserSchema.index({ createdRooms: 1 }); // For fetching user's created rooms
UserSchema.index({ joinedRooms: 1 }); // For fetching user's joined rooms
UserSchema.index({ invitedToRooms: 1 }); // For fetching user's invited rooms
UserSchema.index({ createdAt: 1 }); // For sorting by registration date
UserSchema.index({ email: 1, username: 1 }); // Compound index for login queries

export default mongoose.model<IUser>("User", UserSchema);
