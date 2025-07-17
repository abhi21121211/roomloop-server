import request from "supertest";
import express from "express";
import cors from "cors";
import roomRoutes from "../src/routes/rooms";
import Room from "../src/models/Room";
import {
  createTestUser,
  createTestRoom,
  generateTestToken,
  getAuthHeaders,
  testData,
} from "./helpers/testHelpers";

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use("/api/rooms", roomRoutes);
  return app;
};

describe("Room Endpoints", () => {
  let app: express.Application;
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    app = createTestApp();
    testUser = await createTestUser({
      username: "roomuser",
      email: "room@example.com",
    });
    token = generateTestToken(testUser._id.toString());
  });

  describe("POST /api/rooms", () => {
    it("should create a new room with valid data", async () => {
      const response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send(testData.validRoom)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.room).toMatchObject({
        title: testData.validRoom.title,
        description: testData.validRoom.description,
        roomType: testData.validRoom.roomType,
      });
      expect(response.body.room.creator).toBe(testUser._id.toString());
      expect(response.body.room.code).toBeDefined();

      // Verify room was created in database
      const room = await Room.findOne({ title: testData.validRoom.title });
      expect(room).toBeTruthy();
      expect(room!.creator.toString()).toBe(testUser._id.toString());
    });

    it("should reject room creation without authentication", async () => {
      const response = await request(app)
        .post("/api/rooms")
        .send(testData.validRoom)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject room creation with missing title", async () => {
      const response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send(testData.invalidRooms.noTitle)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject room creation with past start time", async () => {
      const response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send(testData.invalidRooms.pastStartTime)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject room creation with end time before start time", async () => {
      const response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send(testData.invalidRooms.endBeforeStart)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should generate unique room codes", async () => {
      const room1Response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send({
          ...testData.validRoom,
          title: "Room 1",
        })
        .expect(201);

      const room2Response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send({
          ...testData.validRoom,
          title: "Room 2",
        })
        .expect(201);

      expect(room1Response.body.room.code).not.toBe(
        room2Response.body.room.code
      );
    });
  });

  describe("GET /api/rooms/public", () => {
    beforeEach(async () => {
      // Create test rooms
      await createTestRoom(testUser._id, {
        title: "Public Room 1",
        roomType: "public",
      });
      await createTestRoom(testUser._id, {
        title: "Private Room 1",
        roomType: "private",
      });
      await createTestRoom(testUser._id, {
        title: "Public Room 2",
        roomType: "public",
      });
    });

    it("should get all public rooms", async () => {
      const response = await request(app).get("/api/rooms/public").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rooms).toHaveLength(2);

      // All returned rooms should be public
      response.body.rooms.forEach((room: any) => {
        expect(room.roomType).toBe("public");
      });
    });

    it("should not include private rooms in public listing", async () => {
      const response = await request(app).get("/api/rooms/public").expect(200);

      const privatRooms = response.body.rooms.filter(
        (room: any) => room.roomType === "private"
      );
      expect(privatRooms).toHaveLength(0);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/rooms/public?page=1&limit=1")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rooms).toHaveLength(1);
    });
  });

  describe("GET /api/rooms/:id", () => {
    let testRoom: any;

    beforeEach(async () => {
      testRoom = await createTestRoom(testUser._id, {
        title: "Test Room Details",
      });
    });

    it("should get room details by ID", async () => {
      const response = await request(app)
        .get(`/api/rooms/${testRoom._id}`)
        .set(getAuthHeaders(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.room).toMatchObject({
        title: "Test Room Details",
        _id: testRoom._id.toString(),
      });
    });

    it("should reject request with invalid room ID", async () => {
      const response = await request(app)
        .get("/api/rooms/invalid_id")
        .set(getAuthHeaders(token))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should return 404 for non-existent room", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .get(`/api/rooms/${nonExistentId}`)
        .set(getAuthHeaders(token))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("POST /api/rooms/:roomId/join", () => {
    let testRoom: any;
    let otherUser: any;
    let otherToken: string;

    beforeEach(async () => {
      testRoom = await createTestRoom(testUser._id, {
        title: "Room to Join",
        roomType: "public",
      });
      otherUser = await createTestUser({
        username: "otheruser",
        email: "other@example.com",
      });
      otherToken = generateTestToken(otherUser._id.toString());
    });

    it("should allow user to join a public room", async () => {
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/join`)
        .set(getAuthHeaders(otherToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("joined");

      // Verify user was added to participants
      const updatedRoom = await Room.findById(testRoom._id);
      expect(updatedRoom!.participants).toContain(otherUser._id);
    });

    it("should prevent joining the same room twice", async () => {
      // Join room first time
      await request(app)
        .post(`/api/rooms/${testRoom._id}/join`)
        .set(getAuthHeaders(otherToken))
        .expect(200);

      // Try to join again
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/join`)
        .set(getAuthHeaders(otherToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already");
    });

    it("should prevent creator from joining their own room", async () => {
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/join`)
        .set(getAuthHeaders(token))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("creator");
    });

    it("should reject joining with invalid room ID", async () => {
      const response = await request(app)
        .post("/api/rooms/invalid_id/join")
        .set(getAuthHeaders(otherToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /api/rooms/:roomId/invite", () => {
    let testRoom: any;
    let userToInvite: any;

    beforeEach(async () => {
      testRoom = await createTestRoom(testUser._id, {
        title: "Room for Invitations",
        roomType: "private",
      });
      userToInvite = await createTestUser({
        username: "inviteduser",
        email: "invited@example.com",
      });
    });

    it("should allow room creator to invite users", async () => {
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/invite`)
        .set(getAuthHeaders(token))
        .send({
          usernames: ["inviteduser"],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("invited");

      // Verify user was added to invited list
      const updatedRoom = await Room.findById(testRoom._id);
      expect(updatedRoom!.invitedUsers).toContain(userToInvite._id);
    });

    it("should reject invitation from non-creator", async () => {
      const otherUser = await createTestUser({
        username: "noncraetor",
        email: "noncreator@example.com",
      });
      const otherToken = generateTestToken(otherUser._id.toString());

      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/invite`)
        .set(getAuthHeaders(otherToken))
        .send({
          usernames: ["inviteduser"],
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("permission");
    });

    it("should reject invitation with invalid usernames", async () => {
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/invite`)
        .set(getAuthHeaders(token))
        .send({
          usernames: ["nonexistentuser"],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });

    it("should reject invitation with invalid username format", async () => {
      const response = await request(app)
        .post(`/api/rooms/${testRoom._id}/invite`)
        .set(getAuthHeaders(token))
        .send({
          usernames: ["a"], // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to room creation", async () => {
      const promises = Array(12)
        .fill(0)
        .map((_, index) =>
          request(app)
            .post("/api/rooms")
            .set(getAuthHeaders(token))
            .send({
              ...testData.validRoom,
              title: `Test Room ${index}`,
            })
        );

      const responses = await Promise.all(promises);

      // At least one should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize malicious input in room creation", async () => {
      const maliciousRoom = {
        title: '<script>alert("xss")</script>',
        description: '<img src="x" onerror="alert(1)">',
        roomType: "public",
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      };

      const response = await request(app)
        .post("/api/rooms")
        .set(getAuthHeaders(token))
        .send(maliciousRoom);

      if (response.status === 201) {
        // If creation succeeds, ensure content is sanitized
        expect(response.body.room.title).not.toContain("<script>");
        expect(response.body.room.description).not.toContain("<img");
      }
    });
  });
});
