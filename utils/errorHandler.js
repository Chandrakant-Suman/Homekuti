// utils/errorHandler.js
// Centralized error handling for Homekuti

const ExpressError = require("./ExpressError");

/**
 * Environment check helper
 */
const isDevelopment = () => process.env.NODE_ENV !== "production";

/**
 * Log errors with context
 */
const logError = (err, req = null) => {
  const errorInfo = {
    message: err.message,
    statusCode: err.statusCode || 500,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };

  if (req) {
    errorInfo.request = {
      path: req.path,
      method: req.method,
      ip: req.ip,
      user: req.user?.username || "anonymous",
    };
  }

  if (!isDevelopment()) {
    // Production: structured JSON logging
    console.error(JSON.stringify(errorInfo));
    // TODO: Send to external service (Sentry, LogRocket, etc.)
  } else {
    // Development: readable logging
    console.error("\n🔴 ERROR:");
    console.error("Message:", err.message);
    console.error("Status:", err.statusCode || 500);
    if (req) console.error("Path:", req.path);
    console.error("Stack:", err.stack);
    console.error("");
  }
};

/**
 * Transform Mongoose errors into user-friendly messages
 */
const handleMongooseError = (err, req, res, next) => {
  // Validation Error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    err.statusCode = 400;
    err.message = `Validation Error: ${errors.join(", ")}`;
  }

  // Cast Error (invalid ObjectId)
  if (err.name === "CastError") {
    err.statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}`;
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    err.statusCode = 400;
    err.message = field
      ? `${field} already exists. Please use a different value.`
      : "Duplicate entry detected";
  }

  next(err);
};

/**
 * Transform Multer errors into user-friendly messages
 */
const handleMulterError = (err, req, res, next) => {
  if (err.name === "MulterError") {
    err.statusCode = 400;
    const errorMessages = {
      LIMIT_FILE_SIZE: "File too large. Maximum size is 5MB",
      LIMIT_FILE_COUNT: "Too many files uploaded",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      LIMIT_PART_COUNT: "Too many parts in upload",
    };
    err.message = errorMessages[err.code] || "File upload error";
  }

  // Custom file type error (if you add file filter)
  if (err.message && err.message.includes("Invalid file type")) {
    err.statusCode = 400;
  }

  next(err);
};

/**
 * 404 Handler
 */
const notFoundHandler = (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
};

/**
 * Final error handler - sends response to client
 */
const finalErrorHandler = (err, req, res, next) => {
  const { statusCode = 500 } = err;

  // Set default message
  if (!err.message) err.message = "Something went wrong";

  // Log the error
  logError(err, req);

  // ✅ DON'T modify flash messages here
  // Flash will work normally for all pages
  // We just pass a flag to hide it on error pages

  // API requests get JSON response
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode,
        ...(isDevelopment() && { stack: err.stack }),
      },
    });
  }

  // Regular requests get HTML error page
  // Pass hideFlash flag to prevent flash from showing on error page
  res.status(statusCode).render("error", {
    err: {
      message: err.message,
      statusCode,
      stack: isDevelopment() ? err.stack : null,
    },
    hideFlash: true  // Hide flash messages on error pages
  });
};

/**
 * Setup process-level error handlers
 */
const setupProcessHandlers = () => {
  // Unhandled Promise Rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 UNHANDLED PROMISE REJECTION");
    console.error("Reason:", reason);

    if (!isDevelopment()) {
      // TODO: Send alert to monitoring service
      console.error("⚠️  Consider restarting the application");
    }
  });

  // Uncaught Exceptions
  process.on("uncaughtException", (err) => {
    console.error("💥 UNCAUGHT EXCEPTION");
    console.error(err);

    if (!isDevelopment()) {
      console.error("🚨 Shutting down due to uncaught exception");
      // TODO: Send critical alert
      process.exit(1);
    }
  });

  // Graceful shutdown lives in app.js, next to the server it closes
};

module.exports = {
  handleMongooseError,
  handleMulterError,
  notFoundHandler,
  finalErrorHandler,
  setupProcessHandlers,
  logError,
};