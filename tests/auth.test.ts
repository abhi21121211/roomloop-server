import request from "supertest";
import express from "express";
import cors from "cors";
import authRoutes from "../src/routes/auth";
import User from "../src/models/User";
import {
  createTestUser,
  generateTestToken,
  getAuthHeaders,
  testData,
} from "./helpers/testHelpers";

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use("/api/auth", authRoutes);
  return app;
};

describe("Authentication Endpoints", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(testData.validUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        username: testData.validUser.username,
        email: testData.validUser.email,
      });
      expect(response.body.user.password).toBeUndefined();

      // Verify user was created in database
      const user = await User.findOne({ email: testData.validUser.email });
      expect(user).toBeTruthy();
      expect(user!.username).toBe(testData.validUser.username);
    });

    it("should reject registration with short username", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(testData.invalidUsers.shortUsername)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject registration with invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(testData.invalidUsers.invalidEmail)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject registration with weak password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(testData.invalidUsers.weakPassword)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject duplicate email registration", async () => {
      // Create initial user
      await createTestUser({ email: "duplicate@example.com" });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "newuser",
          email: "duplicate@example.com",
          password: "ValidPassword123!",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already in use");
    });

    it("should reject duplicate username registration", async () => {
      // Create initial user
      await createTestUser({ username: "duplicateuser" });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "duplicateuser",
          email: "new@example.com",
          password: "ValidPassword123!",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already in use");
    });

    it("should hash password before storing", async () => {
      await request(app)
        .post("/api/auth/register")
        .send(testData.validUser)
        .expect(201);

      const user = await User.findOne({ email: testData.validUser.email });
      expect(user!.password).not.toBe(testData.validUser.password);
      expect(user!.password.length).toBeGreaterThan(20); // Hashed password is longer
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: "loginuser",
        email: "login@example.com",
        password: "LoginPassword123!",
      });
    });

    it("should login with valid email and password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "login@example.com",
          password: "LoginPassword123!",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        username: "loginuser",
        email: "login@example.com",
      });
      expect(response.body.user.password).toBeUndefined();
    });

    it("should login with valid username and password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "loginuser",
          password: "LoginPassword123!",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe("loginuser");
    });

    it("should reject login with wrong password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "login@example.com",
          password: "WrongPassword123!",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should reject login with non-existent user", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "nonexistent@example.com",
          password: "SomePassword123!",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should reject login with missing credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "",
          password: "SomePassword123!",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });

    it("should reject login with empty password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          login: "login@example.com",
          password: "",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("GET /api/auth/me", () => {
    let testUser: any;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: "profileuser",
        email: "profile@example.com",
      });
      token = generateTestToken(testUser._id.toString());
    });

    it("should get current user profile with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeaders(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toMatchObject({
        username: "profileuser",
        email: "profile@example.com",
      });
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.createdRooms).toBeDefined();
      expect(response.body.user.joinedRooms).toBeDefined();
      expect(response.body.user.invitedToRooms).toBeDefined();
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("token");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid_token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid token");
    });

    it("should reject request with expired token", async () => {
      // Create an expired token
      const expiredToken = generateTestToken(testUser._id.toString());
      // Mock Date to simulate token expiration
      const originalNow = Date.now;
      Date.now = () => originalNow() + 8 * 24 * 60 * 60 * 1000; // 8 days later

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);

      // Restore Date.now
      Date.now = originalNow;
    });

    it("should reject request with token for non-existent user", async () => {
      // Delete the user but keep the token
      await User.findByIdAndDelete(testUser._id);

      const response = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeaders(token))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("User not found");
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to login attempts", async () => {
      const loginData = {
        login: "nonexistent@example.com",
        password: "WrongPassword123!",
      };

      // Make multiple failed login attempts
      const promises = Array(6)
        .fill(0)
        .map(() => request(app).post("/api/auth/login").send(loginData));

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429 status)
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it("should apply rate limiting to registration attempts", async () => {
      const promises = Array(6)
        .fill(0)
        .map((_, index) =>
          request(app)
            .post("/api/auth/register")
            .send({
              username: `testuser${index}`,
              email: `test${index}@example.com`,
              password: "TestPassword123!",
            })
        );

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429 status)
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize malicious input in registration", async () => {
      const maliciousData = {
        username: '<script>alert("xss")</script>',
        email: "test@example.com",
        password: "ValidPassword123!",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(maliciousData)
        .expect(400); // Should fail validation due to invalid characters

      expect(response.body.success).toBe(false);
    });

    it("should sanitize HTML entities in user input", async () => {
      const testUser = await createTestUser({
        username: "testuser",
        email: "test@example.com",
      });

      const token = generateTestToken(testUser._id.toString());

      const response = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeaders(token))
        .expect(200);

      // Ensure no HTML is returned
      expect(response.body.user.username).not.toContain("<");
      expect(response.body.user.username).not.toContain(">");
    });
  });
});
