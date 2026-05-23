const pool = require("../db");

/**
 * Endpoint to test database connection status and query latency.
 */
async function checkHealth(req, res) {
  try {
    const start = Date.now();
    const result = await pool.query("SELECT NOW() as now");
    const duration = Date.now() - start;

    return res.json({
      status: "healthy",
      database: "connected",
      latencyMs: duration,
      dbTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database check failed:", error);
    return res.status(500).json({
      status: "unhealthy",
      database: "error",
      error: error.message,
    });
  }
}

module.exports = {
  checkHealth
};
