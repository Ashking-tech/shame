import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import app from "./lib/api-app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.listen(port, host, () => {
  console.log(`Hall server running on http://${host}:${port}`);
});
