import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  message: 'Rate limit exceeded for sensitive operation',
});

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'https://trade.anovex.io',
      'https://anvscan.com',
      'https://docs.anovex.io',
      'https://points.anovex.io',
    ];

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:5173', 'http://localhost:5000');
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const corsMiddleware = cors(corsOptions);

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      const value = req.body[key];
      if (typeof value === 'string') {
        req.body[key] = value.trim();
        
        if (value.includes('<script') || value.includes('javascript:')) {
          return res.status(400).json({ error: 'Invalid input detected' });
        }
      }
    });
  }
  
  next();
}

export function validateContentType(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
}
