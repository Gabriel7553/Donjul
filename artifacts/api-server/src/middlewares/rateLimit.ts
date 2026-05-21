import type { Request, Response, NextFunction, RequestHandler } from "express";

// Lightweight in-memory fixed-window rate limiter (no external dependency).
// Suitable for a single-instance personal app; for multi-instance you'd back
// this with a shared store (e.g. Redis).

type Bucket = { count: number; resetAt: number };

interface Options {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}

export function rateLimit(opts: Options): RequestHandler {
  const { windowMs, max } = opts;
  const keyFn = opts.key ?? ((req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown");
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Opportunistic cleanup so the map can't grow without bound.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }

    const key = keyFn(req);
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests. Please slow down and try again shortly." });
      return;
    }
    next();
  };
}

// Shared limiter for the OpenAI-backed routes so total AI spend per client is bounded.
export const aiRateLimit = rateLimit({ windowMs: 60_000, max: 30 });
