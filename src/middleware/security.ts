import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: [
        "'self'",
        process.env.CORS_ORIGIN || "http://localhost:3000",
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Socket.IO connections
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Rate limiting configurations
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased for development)
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login attempts per windowMs (increased for development)
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

export const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 room creations per hour
  message: {
    success: false,
    message: "Too many rooms created, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 messages per minute
  message: {
    success: false,
    message: "Too many messages sent, please slow down",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account lockout tracking
interface LoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}

const loginAttempts = new Map<string, LoginAttempt>();

// Clear old entries every hour
setInterval(() => {
  const now = new Date();
  for (const [key, attempt] of loginAttempts.entries()) {
    if (attempt.lockedUntil && now > attempt.lockedUntil) {
      loginAttempts.delete(key);
    } else if (
      now.getTime() - attempt.lastAttempt.getTime() >
      24 * 60 * 60 * 1000
    ) {
      // Remove entries older than 24 hours
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export const checkAccountLockout = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const identifier = req.body.login?.toLowerCase() || req.ip;
  const attempt = loginAttempts.get(identifier);

  if (attempt && attempt.lockedUntil && new Date() < attempt.lockedUntil) {
    const remainingTime = Math.ceil(
      (attempt.lockedUntil.getTime() - Date.now()) / 1000 / 60
    );
    return res.status(423).json({
      success: false,
      message: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
    });
  }

  next();
};

export const recordLoginAttempt = (identifier: string, success: boolean) => {
  const attempt = loginAttempts.get(identifier) || {
    count: 0,
    lastAttempt: new Date(),
  };

  if (success) {
    // Reset on successful login
    loginAttempts.delete(identifier);
  } else {
    attempt.count += 1;
    attempt.lastAttempt = new Date();

    // Lock account after 10 failed attempts (increased for development)
    if (attempt.count >= 10) {
      attempt.lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes (reduced)
    }

    loginAttempts.set(identifier, attempt);
  }
};

// Sanitize user input to prevent XSS
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === "string") {
      // Basic XSS prevention
      return value
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === "object" && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
};

// CORS configuration
export const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    const allowedOrigins = [
      process.env.CORS_ORIGIN || "http://localhost:3000",
      "http://localhost:3000",
      "https://roomloop-client.vercel.app",
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
