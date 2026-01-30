import type { Request, Response } from 'express';
import { getAll } from './toolRegistry.js';

export function getToolsHandler(_req: Request, res: Response): void {
  const tools = getAll();
  res.json({
    tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  });
}
