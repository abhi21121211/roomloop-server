import Redis from "ioredis";
import { loggerHelpers } from "../utils/logger";

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Cache configuration
const CACHE_TTL = {
  USER_SESSION: 24 * 60 * 60, // 24 hours
  ROOM_LIST: 5 * 60, // 5 minutes
  ROOM_DETAILS: 10 * 60, // 10 minutes
  USER_PROFILE: 30 * 60, // 30 minutes
  API_RESPONSE: 2 * 60, // 2 minutes
  MESSAGE_HISTORY: 1 * 60, // 1 minute
  REACTION_COUNT: 5 * 60, // 5 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  USER_SESSION: "user:session:",
  ROOM_LIST: "room:list:",
  ROOM_DETAILS: "room:details:",
  USER_PROFILE: "user:profile:",
  API_RESPONSE: "api:response:",
  MESSAGE_HISTORY: "message:history:",
  REACTION_COUNT: "reaction:count:",
  ONLINE_USERS: "online:users:",
  ROOM_PARTICIPANTS: "room:participants:",
};

// Cache service class
class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = redis;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.redis.on("connect", () => {
      this.isConnected = true;
      loggerHelpers.logPerformance("redis_connected", Date.now(), "timestamp", {
        host: redisConfig.host,
        port: redisConfig.port,
      });
    });

    this.redis.on("error", (error) => {
      this.isConnected = false;
      loggerHelpers.logError(error, { service: "redis_cache" });
    });

    this.redis.on("ready", () => {
      this.isConnected = true;
      loggerHelpers.logPerformance("redis_ready", Date.now(), "timestamp");
    });

    this.redis.on("close", () => {
      this.isConnected = false;
      loggerHelpers.logPerformance(
        "redis_disconnected",
        Date.now(),
        "timestamp"
      );
    });
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const startTime = Date.now();
      const data = await this.redis.get(key);
      const duration = Date.now() - startTime;

      if (data) {
        loggerHelpers.logPerformance("cache_hit", duration, "ms", { key });
        return JSON.parse(data);
      }

      loggerHelpers.logPerformance("cache_miss", duration, "ms", { key });
      return null;
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "cache_get", key });
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttl: number = CACHE_TTL.API_RESPONSE
  ): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const startTime = Date.now();
      await this.redis.setex(key, ttl, JSON.stringify(value));
      const duration = Date.now() - startTime;

      loggerHelpers.logPerformance("cache_set", duration, "ms", { key, ttl });
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "cache_set", key });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.redis.del(key);
      loggerHelpers.logPerformance("cache_delete", Date.now(), "timestamp", {
        key,
      });
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "cache_delete",
        key,
      });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "cache_exists",
        key,
      });
      return false;
    }
  }

  // User session caching
  async setUserSession(userId: string, sessionData: any): Promise<void> {
    const key = `${CACHE_KEYS.USER_SESSION}${userId}`;
    await this.set(key, sessionData, CACHE_TTL.USER_SESSION);
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `${CACHE_KEYS.USER_SESSION}${userId}`;
    return this.get(key);
  }

  async invalidateUserSession(userId: string): Promise<void> {
    const key = `${CACHE_KEYS.USER_SESSION}${userId}`;
    await this.del(key);
  }

  // Room caching
  async setRoomList(filter: string, rooms: any[]): Promise<void> {
    const key = `${CACHE_KEYS.ROOM_LIST}${filter}`;
    await this.set(key, rooms, CACHE_TTL.ROOM_LIST);
  }

  async getRoomList(filter: string): Promise<any[] | null> {
    const key = `${CACHE_KEYS.ROOM_LIST}${filter}`;
    return this.get(key);
  }

  async setRoomDetails(roomId: string, roomData: any): Promise<void> {
    const key = `${CACHE_KEYS.ROOM_DETAILS}${roomId}`;
    await this.set(key, roomData, CACHE_TTL.ROOM_DETAILS);
  }

  async getRoomDetails(roomId: string): Promise<any | null> {
    const key = `${CACHE_KEYS.ROOM_DETAILS}${roomId}`;
    return this.get(key);
  }

  async invalidateRoomCache(roomId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    const roomKey = `${CACHE_KEYS.ROOM_DETAILS}${roomId}`;
    const listKeys = await this.redis.keys(`${CACHE_KEYS.ROOM_LIST}*`);

    await Promise.all([
      this.del(roomKey),
      ...listKeys.map((key) => this.del(key)),
    ]);
  }

  // User profile caching
  async setUserProfile(userId: string, profileData: any): Promise<void> {
    const key = `${CACHE_KEYS.USER_PROFILE}${userId}`;
    await this.set(key, profileData, CACHE_TTL.USER_PROFILE);
  }

  async getUserProfile(userId: string): Promise<any | null> {
    const key = `${CACHE_KEYS.USER_PROFILE}${userId}`;
    return this.get(key);
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    const key = `${CACHE_KEYS.USER_PROFILE}${userId}`;
    await this.del(key);
  }

  // API response caching
  async setApiResponse(
    endpoint: string,
    params: any,
    response: any
  ): Promise<void> {
    const key = `${CACHE_KEYS.API_RESPONSE}${endpoint}:${JSON.stringify(
      params
    )}`;
    await this.set(key, response, CACHE_TTL.API_RESPONSE);
  }

  async getApiResponse(endpoint: string, params: any): Promise<any | null> {
    const key = `${CACHE_KEYS.API_RESPONSE}${endpoint}:${JSON.stringify(
      params
    )}`;
    return this.get(key);
  }

  // Message history caching
  async setMessageHistory(roomId: string, messages: any[]): Promise<void> {
    const key = `${CACHE_KEYS.MESSAGE_HISTORY}${roomId}`;
    await this.set(key, messages, CACHE_TTL.MESSAGE_HISTORY);
  }

  async getMessageHistory(roomId: string): Promise<any[] | null> {
    const key = `${CACHE_KEYS.MESSAGE_HISTORY}${roomId}`;
    return this.get(key);
  }

  async invalidateMessageHistory(roomId: string): Promise<void> {
    const key = `${CACHE_KEYS.MESSAGE_HISTORY}${roomId}`;
    await this.del(key);
  }

  // Online users tracking
  async setOnlineUser(userId: string, socketId: string): Promise<void> {
    const key = `${CACHE_KEYS.ONLINE_USERS}${userId}`;
    await this.set(
      key,
      { socketId, lastSeen: Date.now() },
      CACHE_TTL.USER_SESSION
    );
  }

  async getOnlineUser(userId: string): Promise<any | null> {
    const key = `${CACHE_KEYS.ONLINE_USERS}${userId}`;
    return this.get(key);
  }

  async removeOnlineUser(userId: string): Promise<void> {
    const key = `${CACHE_KEYS.ONLINE_USERS}${userId}`;
    await this.del(key);
  }

  // Room participants caching
  async setRoomParticipants(
    roomId: string,
    participants: string[]
  ): Promise<void> {
    const key = `${CACHE_KEYS.ROOM_PARTICIPANTS}${roomId}`;
    await this.set(key, participants, CACHE_TTL.ROOM_DETAILS);
  }

  async getRoomParticipants(roomId: string): Promise<string[] | null> {
    const key = `${CACHE_KEYS.ROOM_PARTICIPANTS}${roomId}`;
    return this.get(key);
  }

  async addRoomParticipant(roomId: string, userId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    const key = `${CACHE_KEYS.ROOM_PARTICIPANTS}${roomId}`;
    const participants = (await this.get<string[]>(key)) || [];
    if (!participants.includes(userId)) {
      participants.push(userId);
      await this.set(key, participants, CACHE_TTL.ROOM_DETAILS);
    }
  }

  async removeRoomParticipant(roomId: string, userId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    const key = `${CACHE_KEYS.ROOM_PARTICIPANTS}${roomId}`;
    const participants = (await this.get<string[]>(key)) || [];
    const filtered = participants.filter((id) => id !== userId);
    await this.set(key, filtered, CACHE_TTL.ROOM_DETAILS);
  }

  // Cache warming and maintenance
  async warmCache(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      loggerHelpers.logPerformance(
        "cache_warming_started",
        Date.now(),
        "timestamp"
      );

      // Warm up frequently accessed data
      // This could include popular rooms, active users, etc.

      loggerHelpers.logPerformance(
        "cache_warming_completed",
        Date.now(),
        "timestamp"
      );
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "cache_warming" });
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.redis.flushdb();
      loggerHelpers.logPerformance("cache_cleared", Date.now(), "timestamp");
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "cache_clear_all" });
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }

  // Get cache statistics
  async getStats(): Promise<any> {
    if (!this.isConnected) {
      return {
        connected: false,
        error: "Redis not connected",
      };
    }

    try {
      const info = await this.redis.info();
      const keyspace = await this.redis.info("keyspace");

      return {
        connected: this.redis.status === "ready",
        keyspace,
        info: info.split("\r\n").reduce((acc: any, line) => {
          const [key, value] = line.split(":");
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
      };
    } catch (error) {
      loggerHelpers.logError(error as Error, { operation: "cache_stats" });
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown cache error",
      };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
