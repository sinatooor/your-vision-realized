import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { router } from "./routes";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.NEXT_PUBLIC_WEB_URL || "*" }));
app.use(express.json());
app.use("/api", router);

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
