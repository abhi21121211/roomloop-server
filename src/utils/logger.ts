import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Define custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(logColors);

// Custom format for console output
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    const metaString = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : "";
    return `${timestamp} [${level}]: ${stack || message}${metaString}`;
  })
);

// Custom format for file output
const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json()
);

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), "logs");

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: consoleFormat,
  }),
];

// Only add file transports in production or when LOG_TO_FILE is set
if (
  process.env.NODE_ENV === "production" ||
  process.env.LOG_TO_FILE === "true"
) {
  transports.push(
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    // HTTP access logs
    new winston.transports.File({
      filename: path.join(logDir, "access.log"),
      level: "http",
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: path.join(logDir, "exceptions.log"),
            format: fileFormat,
          }),
        ]
      : []),
  ],
  rejectionHandlers: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: path.join(logDir, "rejections.log"),
            format: fileFormat,
          }),
        ]
      : []),
  ],
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const loggerHelpers = {
  // Log user actions
  logUserAction: (userId: string, action: string, details?: any) => {
    logger.info("User action", {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      type: "user_action",
    });
  },

  // Log room events
  logRoomEvent: (
    roomId: string,
    event: string,
    userId?: string,
    details?: any
  ) => {
    logger.info("Room event", {
      roomId,
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
      type: "room_event",
    });
  },

  // Log security events
  logSecurityEvent: (
    event: string,
    ip: string,
    userId?: string,
    details?: any
  ) => {
    logger.warn("Security event", {
      event,
      ip,
      userId,
      details,
      timestamp: new Date().toISOString(),
      type: "security_event",
    });
  },

  // Log database operations
  logDatabaseOperation: (
    operation: string,
    collection: string,
    duration?: number,
    details?: any
  ) => {
    logger.debug("Database operation", {
      operation,
      collection,
      duration,
      details,
      timestamp: new Date().toISOString(),
      type: "db_operation",
    });
  },

  // Log API requests
  logApiRequest: (
    method: string,
    url: string,
    userId?: string,
    duration?: number,
    statusCode?: number
  ) => {
    logger.http("API request", {
      method,
      url,
      userId,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
      type: "api_request",
    });
  },

  // Log errors with context
  logError: (error: Error, context?: any) => {
    logger.error("Application error", {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      type: "application_error",
    });
  },

  // Log performance metrics
  logPerformance: (
    metric: string,
    value: number,
    unit: string,
    context?: any
  ) => {
    logger.info("Performance metric", {
      metric,
      value,
      unit,
      context,
      timestamp: new Date().toISOString(),
      type: "performance_metric",
    });
  },

  // Log Socket.IO events
  logSocketEvent: (
    event: string,
    socketId: string,
    userId?: string,
    roomId?: string,
    details?: any
  ) => {
    logger.debug("Socket event", {
      event,
      socketId,
      userId,
      roomId,
      details,
      timestamp: new Date().toISOString(),
      type: "socket_event",
    });
  },
};

export default logger;
