const pool = require("../db");
const { triggerFrontendRevalidation } = require("../revalidator");

/**
 * Fetch and sort all zodiac signs.
 */
async function getHoroscopes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, english_name AS "englishName", symbol, date_bengali AS "dateBengali",
              element, ruler, stone, image, horoscope, love, career, wealth, business
       FROM zodiacs`
    );

    const order = [
      "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
      "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];

    rows.sort((a, b) => order.indexOf(a.englishName) - order.indexOf(b.englishName));
    return res.json(rows);
  } catch (error) {
    console.error("Error querying zodiacs:", error);
    return res.status(500).json({ error: "Failed to query zodiacs from database" });
  }
}

/**
 * Save manual horoscope modifications.
 */
async function saveHoroscopes(req, res) {
  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid zodiac data format" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const sign of data) {
      await client.query(
        `INSERT INTO zodiacs (
          id, name, english_name, symbol, date_bengali, element, ruler, stone, image, horoscope, love, career, wealth, business
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          english_name = EXCLUDED.english_name,
          symbol = EXCLUDED.symbol,
          date_bengali = EXCLUDED.date_bengali,
          element = EXCLUDED.element,
          ruler = EXCLUDED.ruler,
          stone = EXCLUDED.stone,
          image = EXCLUDED.image,
          horoscope = EXCLUDED.horoscope,
          love = EXCLUDED.love,
          career = EXCLUDED.career,
          wealth = EXCLUDED.wealth,
          business = EXCLUDED.business,
          updated_at = NOW()`,
        [
          sign.id,
          sign.name,
          sign.englishName,
          sign.symbol,
          sign.dateBengali,
          sign.element,
          sign.ruler,
          sign.stone,
          sign.image,
          JSON.stringify(sign.horoscope),
          sign.love,
          sign.career,
          sign.wealth,
          sign.business,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (dbError) {
    await client.query("ROLLBACK");
    console.error("Failed to save horoscope transaction:", dbError);
    return res.status(500).json({ error: "Database transaction failed", details: dbError.message });
  } finally {
    client.release();
  }

  // Log activity
  try {
    await pool.query(
      "INSERT INTO activity_logs (admin_username, action, details) VALUES ($1, $2, $3)",
      [req.adminUsername, "UPDATE_HOROSCOPE", "রাশিফল এবং রাশির অন্যান্য তথ্য সংশোধন করা হয়েছে"]
    );
  } catch (logErr) {
    console.error("Failed to log activity:", logErr);
  }

  // Trigger on-demand ISR revalidation
  triggerFrontendRevalidation();

  return res.json({ success: true, message: "Zodiac data updated successfully in database" });
}

module.exports = {
  getHoroscopes,
  saveHoroscopes
};
