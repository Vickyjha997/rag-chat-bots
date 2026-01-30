import { NextFunction, Request, Response } from "express"

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const raw = req.headers.authorization
  if (!raw) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw
  if (token !== process.env.RAG_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}