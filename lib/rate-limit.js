export function createRateLimiter({ maxRequests, windowMs, message }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      setRateLimitHeaders(res, maxRequests - 1, windowMs);
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      setRateLimitHeaders(res, 0, bucket.resetAt - now);
      res.status(429).json({ error: message });
      return;
    }

    bucket.count += 1;
    setRateLimitHeaders(res, Math.max(0, maxRequests - bucket.count), bucket.resetAt - now);
    next();
  };
}

function setRateLimitHeaders(res, remaining, resetInMs) {
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.max(1, Math.ceil(resetInMs / 1000)));
}

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}
