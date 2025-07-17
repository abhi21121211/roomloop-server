import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Connect to the in-memory database
  await mongoose.connect(uri);
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();

  // Stop MongoDB Memory Server
  await mongoServer.stop();
});

// Clean up before each test
beforeEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_key";
process.env.LOG_LEVEL = "error"; // Reduce logging noise during tests
