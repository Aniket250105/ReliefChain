import { Request, Response } from 'express';
import { loginUser, registerUser, requestPasswordReset, resetPassword, changePassword, getUserProfile } from './auth.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
    }

    const { token, user } = await loginUser(email, password);

    // Secure HTTP-only cookie configuration
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    return res.status(200).json({ token, user });
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    if (error.message.includes('pending') || error.message.includes('rejected') || error.message.includes('suspended')) {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const result = await registerUser(req.body);
    return res.status(201).json(result);
  } catch (error: any) {
    if (error.message.includes('cannot be self-registered') ||
        error.message.includes('Invalid registration role') ||
        error.message.includes('do not match') ||
        error.message.includes('Invalid email') ||
        error.message.includes('Full name') ||
        error.message.includes('Phone must') ||
        error.message.includes('PIN code') ||
        error.message.includes('Password must') ||
        error.message.includes('already exists')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
    }
    const result = await requestPasswordReset(email);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Bad Request', message: 'Token, new password, and confirm password are required' });
    }
    const result = await resetPassword(token, newPassword, confirmPassword);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'Invalid or expired reset token') {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    if (error.message.includes('do not match') || error.message.includes('Password must')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const changePasswordHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Bad Request', message: 'Current password, new password, and confirm password are required' });
    }
    const result = await changePassword(req.user.id, currentPassword, newPassword, confirmPassword);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    if (error.message.includes('do not match') || error.message.includes('Password must')) {
      return res.status(400).json({ error: 'Bad Request', message: error.message });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const profile = await getUserProfile(req.user.id);
    return res.status(200).json(profile);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
};
