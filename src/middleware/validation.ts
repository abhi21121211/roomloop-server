import { body, param, query, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

// Middleware to handle validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Authentication validation rules
export const validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Username can only contain letters, numbers, underscores, and hyphens"
    )
    .escape(),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters"),

  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),

  handleValidationErrors,
];

export const validateLogin = [
  body("login")
    .trim()
    .notEmpty()
    .withMessage("Email or username is required")
    .isLength({ max: 255 })
    .withMessage("Login field must not exceed 255 characters")
    .escape(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 128 })
    .withMessage("Password must not exceed 128 characters"),

  handleValidationErrors,
];

// Room validation rules
export const validateCreateRoom = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Room title must be between 1 and 100 characters")
    .escape(),

  body("description")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Room description must be between 1 and 1000 characters")
    .escape(),

  body("roomType")
    .isIn(["public", "private"])
    .withMessage("Room type must be either public or private"),

  body("startTime")
    .isISO8601()
    .withMessage("Start time must be a valid ISO 8601 date")
    .toDate(),

  body("endTime")
    .isISO8601()
    .withMessage("End time must be a valid ISO 8601 date")
    .toDate()
    .custom((endTime: string, { req }: { req: any }) => {
      if (new Date(endTime) <= new Date(req.body.startTime)) {
        throw new Error("End time must be after start time");
      }
      if (new Date(endTime) <= new Date()) {
        throw new Error("End time must be in the future");
      }
      return true;
    }),

  body("maxParticipants")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Max participants must be between 1 and 10000"),

  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Maximum 10 tags allowed")
    .custom((tags: any) => {
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.length > 50) {
            throw new Error(
              "Each tag must be a string with maximum 50 characters"
            );
          }
        }
      }
      return true;
    }),

  handleValidationErrors,
];

export const validateRoomId = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  handleValidationErrors,
];

export const validateJoinRoom = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  handleValidationErrors,
];

export const validateInviteUsers = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  body("usernames")
    .isArray({ min: 1, max: 50 })
    .withMessage("Must provide 1-50 usernames")
    .custom((usernames: any) => {
      for (const username of usernames) {
        if (
          typeof username !== "string" ||
          username.length < 3 ||
          username.length > 30
        ) {
          throw new Error("Each username must be between 3 and 30 characters");
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          throw new Error(
            "Usernames can only contain letters, numbers, underscores, and hyphens"
          );
        }
      }
      return true;
    }),

  handleValidationErrors,
];

// Message validation rules
export const validateSendMessage = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Message content must be between 1 and 2000 characters")
    .escape(),

  handleValidationErrors,
];

export const validateGetMessages = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

// Reaction validation rules
export const validateSendReaction = [
  param("roomId").isMongoId().withMessage("Invalid room ID format"),

  body("emoji")
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage("Emoji must be between 1 and 10 characters")
    .matches(
      /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|👍|👎|❤️|😊|🎉$/u
    )
    .withMessage("Invalid emoji format"),

  handleValidationErrors,
];

// General purpose validations
export const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  handleValidationErrors,
];

export const sanitizeSearchQuery = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query must not exceed 100 characters")
    .escape(),

  handleValidationErrors,
];
