import express from "express";
import multer from "multer";

import {
  adminToken,
  apiLimitMax,
  apiLimitWindowMs,
  deleteLimitMax,
  deleteLimitWindowMs,
  uploadLimitMax,
  uploadLimitWindowMs,
} from "./config.js";
import { createPost, deletePostById, listPosts } from "./posts-service.js";
import { createRateLimiter } from "./rate-limit.js";

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("Only JPG, PNG, WEBP, and GIF images are allowed."));
      return;
    }

    callback(null, true);
  },
});

const generalApiLimiter = createRateLimiter({
  maxRequests: apiLimitMax,
  windowMs: apiLimitWindowMs,
  message: "Too many requests. Please slow down.",
});

const uploadLimiter = createRateLimiter({
  maxRequests: uploadLimitMax,
  windowMs: uploadLimitWindowMs,
  message: "Upload limit reached. Try again later.",
});

const deleteLimiter = createRateLimiter({
  maxRequests: deleteLimitMax,
  windowMs: deleteLimitWindowMs,
  message: "Too many delete attempts. Try again later.",
});

app.set("trust proxy", 1);
app.use(express.json());

app.get("/api/posts", generalApiLimiter, async (_req, res, next) => {
  try {
    const posts = await listPosts();
    res.json(posts);
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts", uploadLimiter, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }

    const post = await createPost({
      caption: req.body.caption,
      file: req.file,
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/posts/:id", deleteLimiter, async (req, res, next) => {
  try {
    if (!adminToken) {
      res.status(503).json({ error: "Admin delete is not configured on the server." });
      return;
    }

    const providedToken = req.get("x-admin-token");
    if (providedToken !== adminToken) {
      res.status(403).json({ error: "Invalid admin token." });
      return;
    }

    const removed = await deletePostById(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "Image must be smaller than 10MB." });
    return;
  }

  const badRequestMessages = new Set([
    "Only JPG, PNG, WEBP, and GIF images are allowed.",
  ]);

  const status = badRequestMessages.has(error.message) ? 400 : 500;
  res.status(status).json({
    error: status === 500 ? "Something went wrong on the server." : error.message,
  });
});

export default app;
