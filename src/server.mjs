import cors from "cors";
import express from "express";
import { config } from "./config.mjs";
import { checkoutRouter } from "./routes/checkout.mjs";
import { downloadRouter } from "./routes/download.mjs";
import { licenseRouter } from "./routes/license.mjs";
import { webhookRouter } from "./routes/webhooks.mjs";

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "punkat-sales-backend",
  });
});

app.use("/api/checkout", checkoutRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/download", downloadRouter);
app.use("/api/license", licenseRouter);

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    error: error.message || "Unexpected server error.",
    details: error.details || null,
  });
});

app.listen(config.port, () => {
  console.log(`punkat-sales-backend listening on :${config.port}`);
});
