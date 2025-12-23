/**
 * Rate limiting middleware for AI endpoints
 * Implements token bucket algorithm to prevent abuse
 */

import rateLimit from "express-rate-limit";

// AI chat rate limiter: 20 requests per minute per user
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 requests per windowMs
  message: "Too many AI requests, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP address as key (express-rate-limit handles IPv6 correctly)
  // In production, consider using user ID from auth context
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === "development";
  },
});

// IQ file upload rate limiter: 10 uploads per hour per user
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many upload requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP address as key
  skip: (req) => {
    return process.env.NODE_ENV === "development";
  },
});

// Config update rate limiter: 100 requests per minute per user
export const configLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many configuration requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP address as key
  skip: (req) => {
    return process.env.NODE_ENV === "development";
  },
});
