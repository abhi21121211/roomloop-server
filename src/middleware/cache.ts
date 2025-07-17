import { Request, Response, NextFunction } from "express";
import cacheService from "../services/cache";
import { loggerHelpers } from "../utils/logger";

// Cache configuration for different endpoints
const CACHE_CONFIG = {
  // Room endpoints
  "GET:/api/rooms/public": { ttl: 300, key: "room:public" }, // 5 minutes
  "GET:/api/rooms/all": { ttl: 180, key: "room:all" }, // 3 minutes
  "GET:/api/rooms/user": { ttl: 120, key: "room:user" }, // 2 minutes
  "GET:/api/rooms/:id": { ttl: 600, key: "room:details" }, // 10 minutes

  // User endpoints
  "GET:/api/auth/me": { ttl: 1800, key: "user:profile" }, // 30 minutes

  // Message endpoints
  "GET:/api/rooms/:roomId/messages": { ttl: 60, key: "messages" }, // 1 minute

  // Reaction endpoints
  "GET:/api/rooms/:roomId/reactions": { ttl: 300, key: "reactions" }, // 5 minutes
};

// Generate cache key based on request
const generateCacheKey = (req: Request, config: any): string => {
  const baseKey = config.key;
  const userId = req.user?.id || "anonymous";
  const params = req.params;
  const query = req.query;

  // Include relevant parameters in cache key
  const paramString =
    Object.keys(params).length > 0 ? `:${JSON.stringify(params)}` : "";
  const queryString =
    Object.keys(query).length > 0 ? `:${JSON.stringify(query)}` : "";

  return `${baseKey}:${userId}${paramString}${queryString}`;
};

// Check if request should be cached
const shouldCache = (req: Request): boolean => {
  // Only cache GET requests
  if (req.method !== "GET") return false;

  // Don't cache authenticated user-specific data for anonymous users
  if (!req.user && req.path.includes("/user")) return false;

  // Check if endpoint is configured for caching
  const cacheKey = `${req.method}:${req.path.split("/:")[0]}`;
  return CACHE_CONFIG[cacheKey as keyof typeof CACHE_CONFIG] !== undefined;
};

// Cache middleware
export const cacheMiddleware = (duration?: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or if caching is disabled
    if (!shouldCache(req)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = `${req.method}:${req.path.split("/:")[0]}`;
      const config = CACHE_CONFIG[cacheKey as keyof typeof CACHE_CONFIG];

      if (!config) {
        return next();
      }

      const key = generateCacheKey(req, config);
      const ttl = duration || config.ttl;

      // Try to get cached response
      const cachedResponse = await cacheService.get(key);

      if (cachedResponse) {
        // Return cached response
        loggerHelpers.logPerformance(
          "cache_hit_middleware",
          Date.now(),
          "timestamp",
          {
            endpoint: req.path,
            key,
          }
        );

        return res.json(cachedResponse);
      }

      // Cache miss - store original send method
      const originalSend = res.json;

      // Override res.json to cache the response
      res.json = function (data: any) {
        // Cache the response
        cacheService.set(key, data, ttl).catch((error) => {
          loggerHelpers.logError(error, {
            operation: "cache_set_middleware",
            key,
          });
        });

        // Call original send method
        return originalSend.call(this, data);
      };

      loggerHelpers.logPerformance(
        "cache_miss_middleware",
        Date.now(),
        "timestamp",
        {
          endpoint: req.path,
          key,
        }
      );

      next();
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "cache_middleware",
        endpoint: req.path,
      });
      next();
    }
  };
};

// Cache invalidation middleware
export const invalidateCache = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Store original send method
      const originalSend = res.json;

      // Override res.json to invalidate cache after successful response
      res.json = function (data: any) {
        // Invalidate cache patterns
        patterns.forEach(async (pattern) => {
          try {
            // For now, we'll invalidate specific keys
            // In a production environment, you might want to use Redis SCAN
            if (pattern.includes("room:details") && req.params.roomId) {
              await cacheService.invalidateRoomCache(req.params.roomId);
            } else if (pattern.includes("user:profile") && req.user?.id) {
              await cacheService.invalidateUserProfile(req.user.id);
            } else if (pattern.includes("messages") && req.params.roomId) {
              await cacheService.invalidateMessageHistory(req.params.roomId);
            }
          } catch (error) {
            loggerHelpers.logError(error as Error, {
              operation: "cache_invalidation",
              pattern,
            });
          }
        });

        // Call original send method
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      loggerHelpers.logError(error as Error, {
        operation: "invalidate_cache_middleware",
      });
      next();
    }
  };
};

// Specific cache middlewares for different endpoints
export const cacheRoomList = cacheMiddleware(300); // 5 minutes
export const cacheRoomDetails = cacheMiddleware(600); // 10 minutes
export const cacheUserProfile = cacheMiddleware(1800); // 30 minutes
export const cacheMessages = cacheMiddleware(60); // 1 minute
export const cacheReactions = cacheMiddleware(300); // 5 minutes

// Invalidation middlewares
export const invalidateRoomCache = invalidateCache([
  "room:details",
  "room:list",
]);
export const invalidateUserCache = invalidateCache(["user:profile"]);
export const invalidateMessageCache = invalidateCache(["messages"]);

// Cache health check endpoint
export const cacheHealthCheck = async (req: Request, res: Response) => {
  try {
    const isHealthy = await cacheService.healthCheck();
    const stats = await cacheService.getStats();

    res.json({
      success: true,
      cache: {
        healthy: isHealthy,
        stats,
      },
    });
  } catch (error) {
    loggerHelpers.logError(error as Error, {
      operation: "cache_health_check_endpoint",
    });
    res.status(500).json({
      success: false,
      message: "Cache health check failed",
    });
  }
};
