import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { SafeUserDto } from '@reliefchain/shared-types';

export interface AuthenticatedRequest extends Request {
  user?: SafeUserDto;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};
