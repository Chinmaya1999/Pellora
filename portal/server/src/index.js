import "express-async-errors";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config, razorpayEnabled } from "./config.js";
import account from "./routes/account.js";
import billing, { webhook } from "./routes/billing.js";
import { publicApi, playground } from "./routes/gateway.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false })); // Razorpay checkout loads its own script/iframe

// Customer API: any origin (keys authenticate); dashboard API: our own origin only.
app.use("/v1", cors(), publicApi);
app.post("/api/billing/webhook", express.raw({ type: "*/*" }), (req, res, next) => webhook(req, res).catch(next));

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api/playground", playground);
app.use("/api/billing", billing);
app.use("/api", account);

// Serve the built React app in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(api|v1)\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: "server_error", message: "Something went wrong." });
});

await mongoose.connect(config.mongoUri);
app.listen(config.port, () => {
  console.log(`Portal API on :${config.port} | engine ${config.engineUrl} | payments: ${razorpayEnabled ? "Razorpay" : "DEV mock"}`);
});
