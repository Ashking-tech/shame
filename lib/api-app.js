import express from "express";
import multer from "multer";

import {
  adminToken,
  apiLimitMax,
  apiLimitWindowMs,
  deleteLimitMax,
  deleteLimitWindowMs,
  supabaseUrl,
  uploadLimitMax,
  uploadLimitWindowMs,
} from "./config.js";
import { createPost, deletePostById, listPosts } from "./posts-service.js";
import { createRateLimiter } from "./rate-limit.js";

// ponytail: dummy mode — serves local /public/img/* as if uploaded
const DUMMY_POSTS = [
  { id: "dummy-1", caption: "Screenshot 20260531", imageUrl: "/img/Screenshot_20260531_010155.png", createdAt: new Date().toISOString() },
  { id: "dummy-2", caption: "Screenshot 20260610", imageUrl: "/img/Screenshot_20260610_171059.png", createdAt: new Date().toISOString() },
  { id: "dummy-3", caption: "Screenshot 20260614", imageUrl: "/img/Screenshot_20260614_164355.png", createdAt: new Date().toISOString() },
  { id: "dummy-4", caption: "Screenshot 20260617", imageUrl: "/img/Screenshot_20260617_204226.png", createdAt: new Date().toISOString() },
];

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
    if (!posts.length && supabaseUrl.includes("dummy")) return res.json(DUMMY_POSTS);
    res.json(posts);
  } catch (error) {
    if (supabaseUrl.includes("dummy")) return res.json(DUMMY_POSTS);
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

app.get("/api/verify-token", async (req, res) => {
  const providedToken = req.get("x-admin-token");

  if (!adminToken) {
    res.json({ valid: false, configured: false });
    return;
  }

  res.json({ valid: providedToken === adminToken, configured: true });
});

app.delete("/api/posts/:id", deleteLimiter, async (req, res, next) => {
  try {
    // ponytail: dummy cards are local-only
    if (String(req.params.id).startsWith("dummy-")) return res.status(204).end();
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
