import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { processAiAnalysisQueue } from "./service";

export async function processAiQueueScheduled(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const results = await processAiAnalysisQueue(10);
    return res.json({ ok: true, processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI queue processor failed.";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
