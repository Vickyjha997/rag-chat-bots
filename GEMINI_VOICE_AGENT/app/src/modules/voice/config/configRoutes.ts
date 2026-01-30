import { Router, Request, Response } from 'express';

export function createConfigRouter(port: number, wsPort: number): Router {
  const router = Router();
  router.get('/config', (req: Request, res: Response) => {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${port}`;
    const httpBase = process.env.HTTP_BASE_URL || `${protocol}://${host}`;
    const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
    const wsHost = process.env.WS_BASE_URL?.replace(/^wss?:\/\//, '') || host.replace(/:\d+$/, `:${wsPort}`);
    const wsBase = process.env.WS_BASE_URL || `${wsProtocol}://${wsHost}`;
    res.json({ httpBase, wsBase, port, wsPort });
  });
  return router;
}
