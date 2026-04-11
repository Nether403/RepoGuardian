import type { Request, Response, NextFunction } from "express";
import { env } from "../lib/env.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid Bearer token" });
    return;
  }

  const token = authHeader.substring(7);
  if (token !== env.API_SECRET_KEY) {
    res.status(401).json({ error: "Unauthorized: Invalid API key" });
    return;
  }

  next();
}
