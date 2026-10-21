import { Router } from 'express';
import { login, register, forgotPassword, resetPasswordHandler, changePasswordHandler, getProfile, logout } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordHandler);
router.post('/change-password', authenticate, changePasswordHandler);
router.get('/profile', authenticate, getProfile);
router.post('/logout', logout);

export default router;
