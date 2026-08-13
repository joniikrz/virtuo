import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  scope: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit({ windowMs, max, scope, keyGenerator, skipSuccessfulRequests = false }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const now = Date.now();
    const identifier = keyGenerator?.(req) || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${scope}:${identifier}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: `Too many attempts for this account. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter,
      });
      return;
    }

    if (skipSuccessfulRequests) {
      res.once('finish', () => {
        if (res.statusCode >= 400) return;
        const saved = buckets.get(key);
        if (!saved) return;
        saved.count = Math.max(0, saved.count - 1);
        if (saved.count === 0) buckets.delete(key);
      });
    }
    next();
  };
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000);
cleanup.unref();
