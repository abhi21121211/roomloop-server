import jwt from "jsonwebtoken";
import User, { IUser } from "../../src/models/User";
import Room, { IRoom, RoomType, RoomStatus } from "../../src/models/Room";
import { Types } from "mongoose";

// Generate test JWT token
export const generateTestToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "test_secret", {
    expiresIn: "1h",
  });
};

// Create test user
export const createTestUser = async (
  overrides: Partial<IUser> = {}
): Promise<IUser> => {
  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: "TestPassword123!",
    createdRooms: [],
    joinedRooms: [],
    invitedToRooms: [],
  };

  const userData = { ...defaultUser, ...overrides };
  const user = new User(userData);
  await user.save();
  return user;
};

// Create test room
export const createTestRoom = async (
  creatorId: string,
  overrides: Partial<IRoom> = {}
): Promise<IRoom> => {
  const defaultRoom = {
    title: `Test Room ${Date.now()}`,
    description: "A test room for unit testing",
    roomType: RoomType.PUBLIC,
    status: RoomStatus.SCHEDULED,
    creator: new Types.ObjectId(creatorId),
    startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    maxParticipants: 100,
    participants: [],
    invitedUsers: [],
    tags: ["test"],
    code: `TEST_${Date.now()}`,
  };

  const roomData = { ...defaultRoom, ...overrides };
  const room = new Room(roomData);
  await room.save();
  return room;
};

// Create multiple test users
export const createTestUsers = async (count: number): Promise<IUser[]> => {
  const users: IUser[] = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      username: `testuser_${i}_${Date.now()}`,
      email: `test_${i}_${Date.now()}@example.com`,
    });
    users.push(user);
  }
  return users;
};

// Get auth headers for request
export const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

// Test data generators
export const testData = {
  validUser: {
    username: "validuser",
    email: "valid@example.com",
    password: "ValidPassword123!",
  },

  invalidUsers: {
    shortUsername: {
      username: "ab",
      email: "test@example.com",
      password: "ValidPassword123!",
    },
    invalidEmail: {
      username: "validuser",
      email: "invalid-email",
      password: "ValidPassword123!",
    },
    weakPassword: {
      username: "validuser",
      email: "test@example.com",
      password: "weak",
    },
  },

  validRoom: {
    title: "Valid Test Room",
    description: "This is a valid test room",
    roomType: "public" as const,
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    maxParticipants: 50,
    tags: ["test", "valid"],
  },

  invalidRooms: {
    noTitle: {
      description: "Room without title",
      roomType: "public" as const,
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
    pastStartTime: {
      title: "Past Room",
      description: "Room with past start time",
      roomType: "public" as const,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
    },
    endBeforeStart: {
      title: "Invalid Time Room",
      description: "Room with end time before start time",
      roomType: "public" as const,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
    },
  },
};

// Wait for async operations in tests
export const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Clean up test data
export const cleanupTestData = async (): Promise<void> => {
  await User.deleteMany({});
  await Room.deleteMany({});
};
