import { Router } from "express";
import { analysisRouter } from "./analysis";

export const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

router.use("/analysis", analysisRouter);
