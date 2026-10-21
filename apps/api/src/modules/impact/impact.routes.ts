import { Router } from 'express';
import { getImpact } from './impact.controller';

const router = Router();

router.get('/:donId', getImpact);

export default router;
