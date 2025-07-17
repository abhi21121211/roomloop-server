import mongoose from "mongoose";
import { loggerHelpers } from "../utils/logger";
import dotenv from "dotenv";

// Database configuration
const DB_CONFIG = {
  // Connection options
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "10"),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2"),
  maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME || "30000"),
  serverSelectionTimeoutMS: parseInt(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT || "5000"
  ),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || "45000"),
  connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT || "10000"),

  // Retry options (these are NOT passed to mongoose)
  // retryWrites and retryReads are valid, but maxRetries and retryDelay are not
  retryWrites: true,
  retryReads: true,
  // maxRetries: parseInt(process.env.MONGODB_MAX_RETRIES || "3"), // REMOVE
  // retryDelay: parseInt(process.env.MONGODB_RETRY_DELAY || "1000"), // REMOVE

  // Write concern
  writeConcern: {
    w: "majority",
    j: true,
    wtimeout: 10000,
  },

  // Read preference
  readPreference: "primaryPreferred",

  // Monitoring
  monitorCommands: process.env.NODE_ENV !== "production",
};
dotenv.config();
// Connection state tracking
let connectionAttempts = 0;
let isConnected = false;
let connectionStartTime: number;

// Database connection class
class DatabaseConnection {
  private uri: string;
  private options: any;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private maxRetries: number;
  private retryDelay: number;

  constructor(uri: string, options: any = {}) {
    this.uri = uri;
    // Remove maxRetries and retryDelay from options before passing to mongoose
    const { maxRetries, retryDelay, ...mongooseOptions } = {
      ...DB_CONFIG,
      ...options,
    };
    this.options = mongooseOptions;
    this.maxRetries =
      typeof maxRetries === "number"
        ? maxRetries
        : parseInt(process.env.MONGODB_MAX_RETRIES || "3");
    this.retryDelay =
      typeof retryDelay === "number"
        ? retryDelay
        : parseInt(process.env.MONGODB_RETRY_DELAY || "1000");
  }

  // Connect to database with retry logic
  async connect(): Promise<void> {
    try {
      connectionStartTime = Date.now();
      connectionAttempts++;

      loggerHelpers.logPerformance(
        "db_connection_attempt",
        connectionAttempts,
        "attempt",
        {
          uri: this.uri.replace(/\/\/.*@/, "//***:***@"), // Hide credentials
        }
      );

      // Set up connection event handlers
      this.setupEventHandlers();

      // Connect to MongoDB
      await mongoose.connect(this.uri, this.options);

      isConnected = true;
      connectionAttempts = 0;

      const connectionTime = Date.now() - connectionStartTime;
      loggerHelpers.logPerformance("db_connected", connectionTime, "ms", {
        poolSize: this.options.maxPoolSize,
        connectionAttempts: connectionAttempts,
      });
    } catch (error) {
      const connectionTime = Date.now() - connectionStartTime;
      loggerHelpers.logError(error as Error, {
        operation: "db_connect",
        attempt: connectionAttempts,
        connectionTime,
      });

      // Retry connection if max retries not reached
      if (connectionAttempts < this.maxRetries) {
        await this.retryConnection();
      } else {
        loggerHelpers.logError(
          new Error("Max database connection retries reached"),
          {
            operation: "db_connect_max_retries",
            attempts: connectionAttempts,
          }
        );
        process.exit(1);
      }
    }
  }

  // Retry connection with exponential backoff
  private async retryConnection(): Promise<void> {
    const delay = this.retryDelay * Math.pow(2, connectionAttempts - 1);

    loggerHelpers.logPerformance("db_retry_scheduled", delay, "ms", {
      attempt: connectionAttempts,
      maxRetries: this.maxRetries,
    });

    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  // Set up MongoDB connection event handlers
  private setupEventHandlers(): void {
    const connection = mongoose.connection;

    // Connection events
    connection.on("connected", () => {
      isConnected = true;
      loggerHelpers.logPerformance(
        "db_connected_event",
        Date.now(),
        "timestamp"
      );
    });

    connection.on("disconnected", () => {
      isConnected = false;
      loggerHelpers.logPerformance(
        "db_disconnected_event",
        Date.now(),
        "timestamp"
      );
    });

    connection.on("error", (error) => {
      loggerHelpers.logError(error, { operation: "db_connection_error" });
    });

    connection.on("reconnected", () => {
      isConnected = true;
      loggerHelpers.logPerformance(
        "db_reconnected_event",
        Date.now(),
        "timestamp"
      );
    });

    // Monitor commands in development
    if (this.options.monitorCommands) {
      mongoose.set("debug", (collectionName, methodName, ...methodArgs) => {
        loggerHelpers.logDatabaseOperation(
          methodName,
          collectionName,
          undefined,
          {
            args: methodArgs,
          }
        );
      });
    }

    // Monitor connection pool
    setInterval(() => {
      this.monitorConnectionPool();
    }, 60000); // Check every minute
  }

  // Monitor connection pool health
  private monitorConnectionPool(): void {
    const connection = mongoose.connection;

    loggerHelpers.logPerformance("db_pool_status", Date.now(), "timestamp", {
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
    });
  }

  // Disconnect from database
  async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      await mongoose.disconnect();
      isConnected = false;

      loggerHelpers.logPerformance("db_disconnected", Date.now(), "timestamp");
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "db_disconnect" });
    }
  }

  // Get connection status
  getStatus(): any {
    const connection = mongoose.connection;
    return {
      connected: isConnected,
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
      connectionAttempts,
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!isConnected) return false;

      // Ping the database
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "db_health_check" });
      return false;
    }
  }

  // Get database statistics
  async getStats(): Promise<any> {
    try {
      if (!isConnected) {
        return { connected: false };
      }

      const db = mongoose.connection.db;
      const stats = await db.stats();

      return {
        connected: true,
        database: db.databaseName,
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
      };
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "db_stats" });
      return {
        connected: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }
}

// Create and export database connection instance
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/roomloop";
export const dbConnection = new DatabaseConnection(MONGODB_URI);

// Export connection function for easy use
export const connectDatabase = () => dbConnection.connect();
export const disconnectDatabase = () => dbConnection.disconnect();
export const getDatabaseStatus = () => dbConnection.getStatus();
export const checkDatabaseHealth = () => dbConnection.healthCheck();
export const getDatabaseStats = () => dbConnection.getStats();

export default dbConnection;
