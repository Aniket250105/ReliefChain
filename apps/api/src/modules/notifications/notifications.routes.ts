import { Router } from 'express';
import { listNotifications, getUnreadCount, markAsRead } from './notifications.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.patch('/:id/read', authenticate, markAsRead);

export default router;
