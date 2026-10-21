import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000).unref(); // unref so it doesn't block process exit

export const rateLimit = (maxRequests: number = 10, windowMs: number = 60_000) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = `${req.baseUrl}${req.path}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`
      });
    }

    return next();
  };
};
