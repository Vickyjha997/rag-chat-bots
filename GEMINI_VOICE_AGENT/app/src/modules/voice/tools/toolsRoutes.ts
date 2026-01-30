import { Router } from 'express';
import { getToolsHandler } from './toolsHandlers.js';

const router = Router();
router.get('/tools', getToolsHandler);
export default router;
