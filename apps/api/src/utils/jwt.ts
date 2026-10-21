import jwt from 'jsonwebtoken';
import { SafeUserDto } from '@reliefchain/shared-types';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'placeholder-jwt-secret-do-not-use-in-production') {
    throw new Error('Valid JWT_SECRET environment variable is not set');
  }
  return secret;
};

export const signToken = (payload: SafeUserDto): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '1d' });
};

export const verifyToken = (token: string): SafeUserDto => {
  return jwt.verify(token, getJwtSecret()) as SafeUserDto;
};
