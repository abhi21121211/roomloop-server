import { Request, Response, NextFunction } from "express";

// Cache configuration types
interface CacheConfig {
  maxAge: number;
  immutable?: boolean;
  etag?: boolean;
  lastModified?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
}

// Cache configuration for different file types
const CACHE_CONFIG: Record<string, CacheConfig> = {
  // Static assets (CSS, JS, images)
  static: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    immutable: true,
    etag: true,
    lastModified: true,
  },

  // API responses
  api: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    etag: true,
    lastModified: true,
  },

  // User-generated content
  userContent: {
    maxAge: 60 * 60 * 1000, // 1 hour
    etag: true,
    lastModified: true,
  },

  // No cache for sensitive data
  noCache: {
    maxAge: 0,
    noCache: true,
    noStore: true,
    mustRevalidate: true,
  },
};

// Set cache headers middleware
export const setCacheHeaders = (cacheType: keyof typeof CACHE_CONFIG) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = CACHE_CONFIG[cacheType];

    if (config.maxAge > 0) {
      res.set("Cache-Control", `public, max-age=${config.maxAge / 1000}`);
    }

    if (config.immutable) {
      res.set("Cache-Control", res.get("Cache-Control") + ", immutable");
    }

    if (config.etag) {
      res.set("ETag", generateETag(req.url + Date.now()));
    }

    if (config.lastModified) {
      res.set("Last-Modified", new Date().toUTCString());
    }

    if (config.noCache) {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }

    next();
  };
};

// Generate simple ETag
const generateETag = (content: string): string => {
  return `"${Buffer.from(content).toString("base64").substring(0, 8)}"`;
};

// Conditional GET middleware (ETag support)
export const conditionalGet = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const etag = req.headers["if-none-match"];
  const lastModified = req.headers["if-modified-since"];

  if (etag || lastModified) {
    // For now, we'll always return fresh content
    // In a real implementation, you'd check against actual content
    res.status(304).end();
    return;
  }

  next();
};

// Static file caching middleware
export const staticCache = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const fileExtension = req.path.split(".").pop()?.toLowerCase();

  // Set appropriate cache headers based on file type
  if (fileExtension) {
    switch (fileExtension) {
      case "css":
      case "js":
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "svg":
      case "ico":
      case "woff":
      case "woff2":
      case "ttf":
      case "eot":
        setCacheHeaders("static")(req, res, next);
        return;

      case "json":
      case "xml":
        setCacheHeaders("api")(req, res, next);
        return;

      default:
        setCacheHeaders("userContent")(req, res, next);
        return;
    }
  }

  // Default to user content caching
  setCacheHeaders("userContent")(req, res, next);
};

// No-cache middleware for sensitive endpoints
export const noCache = setCacheHeaders("noCache");

// API response caching middleware
export const apiCache = setCacheHeaders("api");

// User content caching middleware
export const userContentCache = setCacheHeaders("userContent");
