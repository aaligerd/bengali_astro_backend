const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const apiRouter = require("./routes");
const pool=require('./db.js');
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
const allowedOrigins = process.env.FRONTEND_URL.split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.text({ type: "text/csv", limit: "50mb" }));

pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL");
  })
  .catch(err => {
    console.error("❌ PostgreSQL connection error:", err.stack);
  });

// Mount all modularized API routes under /api
app.use("/api", apiRouter);

// Start Express Listener
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express API Server is running on http://0.0.0.0:${PORT}`);
});
