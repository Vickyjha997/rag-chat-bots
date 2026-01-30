/**
 * Voice module: mount session, tools, and config under /api
 */
import { Router } from 'express';
import sessionRoutes from './session/sessionRoutes.js';
import toolsRoutes from './tools/toolsRoutes.js';
import { createConfigRouter } from './config/configRoutes.js';

export function createVoiceApiRouter(httpPort: number, wsPort: number): Router {
  const router = Router();
  router.use(sessionRoutes);
  router.use(toolsRoutes);
  router.use(createConfigRouter(httpPort, wsPort));
  return router;
}
