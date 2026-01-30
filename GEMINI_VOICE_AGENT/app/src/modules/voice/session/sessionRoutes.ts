import { Router, Request, Response } from 'express';
import { createSessionHandler, getSessionHandler, deleteSessionHandler } from './sessionHandlers.js';

const router = Router();

router.options('/sessions', (_req: Request, res: Response) => res.sendStatus(200));
router.post('/sessions', createSessionHandler);
router.get('/sessions/:sessionId', getSessionHandler);
router.delete('/sessions/:sessionId', deleteSessionHandler);

export default router;
