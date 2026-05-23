const pool = require("../db");
const bcrypt = require("bcryptjs");
const { signToken, verifyToken } = require("../jwt");
const { parseCSV } = require("../csv-parser");
const { triggerFrontendRevalidation } = require("../revalidator");

/**
 * Handle admin login credentials verification.
 */
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "ইউজারনেম বা পাসওয়ার্ড ভুল!" });
    }

    const admin = rows[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "ইউজারনেম বা পাসওয়ার্ড ভুল!" });
    }

    // Set cookie session
    const token = signToken({ username: admin.username });
    res.cookie("astro_session", token, {
      httpOnly: true,
      secure: true, // required for cross-origin sameSite: "none"
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Log login activity
    await pool.query(
      "INSERT INTO activity_logs (admin_username, action, details) VALUES ($1, $2, $3)",
      [admin.username, "LOGIN", "অ্যাডমিন পোর্টালে সফল লগইন করা হয়েছে"]
    );

    return res.json({ success: true, username: admin.username });
  } catch (error) {
    console.error("Login API error:", error);
    return res.status(500).json({ error: "সার্ভারে লগইন প্রসেস করতে ত্রুটি হয়েছে" });
  }
}

/**
 * Handle admin logout session clearance.
 */
async function logout(req, res) {
  const token = req.cookies.astro_session;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.username) {
      try {
        await pool.query(
          "INSERT INTO activity_logs (admin_username, action, details) VALUES ($1, $2, $3)",
          [decoded.username, "LOGOUT", "অ্যাডমিন পোর্টাল থেকে লগআউট করা হয়েছে"]
        );
      } catch (err) {
        console.error("Failed to log logout activity:", err);
      }
    }
  }

  res.clearCookie("astro_session", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  return res.json({ success: true, message: "Logged out successfully" });
}

/**
 * Check admin session cookie validation status.
 */
function checkSession(req, res) {
  const token = req.cookies.astro_session;
  if (!token) {
    return res.json({ authenticated: false });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.username) {
    return res.json({ authenticated: false });
  }

  return res.json({ authenticated: true, username: decoded.username });
}

/**
 * Create a new admin credential.
 */
async function createAdmin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);
    if (rows.length > 0) {
      return res.status(400).json({ error: "এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
      [username, hashedPassword]
    );

    // Log admin creation
    await pool.query(
      "INSERT INTO activity_logs (admin_username, action, details) VALUES ($1, $2, $3)",
      [req.adminUsername, "CREATE_ADMIN", `নতুন অ্যাডমিন অ্যাকাউন্ট '${username}' তৈরি করা হয়েছে`]
    );

    return res.json({ success: true, message: `অ্যাডমিন '${username}' সফলভাবে তৈরি হয়েছে।` });
  } catch (error) {
    console.error("Create admin error:", error);
    return res.status(500).json({ error: "নতুন অ্যাডমিন তৈরি করতে ব্যর্থ হয়েছে।" });
  }
}

/**
 * Fetch paginated audit/activity logs.
 */
async function getLogs(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  try {
    const countRes = await pool.query("SELECT COUNT(*) FROM activity_logs");
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const logsRes = await pool.query(
      `SELECT id, admin_username AS "adminUsername", action, details, created_at AS "createdAt"
       FROM activity_logs ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({
      logs: logsRes.rows,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    console.error("Logs query error:", error);
    return res.status(500).json({ error: "অ্যাক্টিভিটি লগস ডাটাবেজ থেকে রিড করতে ব্যর্থ হয়েছে" });
  }
}

/**
 * Perform bulk horoscope update using CSV payload.
 */
async function bulkUpdateCSV(req, res) {
  const csvText = req.body;

  if (typeof csvText !== "string" || csvText.trim() === "") {
    return res.status(400).json({ error: "সিএসভি ফাইলটি খালি!" });
  }

  try {
    const csvRows = parseCSV(csvText);
    if (csvRows.length < 2) {
      return res.status(400).json({ error: "সিএসভি ফাইলে কোনো ডেটা রো পাওয়া যায়নি!" });
    }

    const headers = csvRows[0].map(h => h.trim().toLowerCase());
    const requiredColumns = ["id", "name", "englishname", "daily", "weekly", "monthly", "yearly"];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({ error: `সিএসভি ফাইলে প্রয়োজনীয় কলাম অনুপস্থিত: ${missingColumns.join(", ")}` });
    }

    const colIdx = (name) => headers.indexOf(name);
    const zodiacData = [];

    for (let r = 1; r < csvRows.length; r++) {
      const row = csvRows[r];
      if (row.length === 1 && row[0] === "") continue;

      const id = row[colIdx("id")]?.trim().toLowerCase();
      if (!id) {
        return res.status(400).json({ error: `লাইন নম্বর ${r + 1}: 'id' কলামটি খালি হতে পারবে না!` });
      }

      const name = row[colIdx("name")]?.trim();
      const englishName = row[colIdx("englishname")]?.trim() || id.charAt(0).toUpperCase() + id.slice(1);

      if (!name) {
        return res.status(400).json({ error: `লাইন নম্বর ${r + 1}: 'name' কলামটি খালি হতে পারবে না!` });
      }

      const horoscope = {
        daily: row[colIdx("daily")] || "",
        weekly: row[colIdx("weekly")] || "",
        monthly: row[colIdx("monthly")] || "",
        yearly: row[colIdx("yearly")] || "",
      };

      zodiacData.push({
        id,
        name,
        englishName,
        symbol: row[colIdx("symbol")] || "",
        dateBengali: row[colIdx("datebengali")] || "",
        element: row[colIdx("element")] || "",
        ruler: row[colIdx("ruler")] || "",
        stone: row[colIdx("stone")] || "",
        image: row[colIdx("image")] || "",
        horoscope,
        love: row[colIdx("love")] || "",
        career: row[colIdx("career")] || "",
        wealth: row[colIdx("wealth")] || "",
        business: row[colIdx("business")] || "",
      });
    }

    if (zodiacData.length === 0) {
      return res.status(400).json({ error: "সিএসভি ফাইলে কোনো প্রসেস করার মতো রাশির ডেটা পাওয়া যায়নি!" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const sign of zodiacData) {
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
      console.error("Bulk CSV transaction failed:", dbError);
      return res.status(500).json({ error: "সিএসভি ট্রানজেকশন ব্যর্থ হয়েছে", details: dbError.message });
    } finally {
      client.release();
    }

    // Log activity
    await pool.query(
      "INSERT INTO activity_logs (admin_username, action, details) VALUES ($1, $2, $3)",
      [req.adminUsername, "BULK_UPDATE_CSV", `সিএসভি (CSV) ফাইল আপলোড করে মোট ${zodiacData.length}টি রাশির তথ্য বাল্ক আপডেট করা হয়েছে`]
    );

    // Trigger revalidation
    triggerFrontendRevalidation();

    return res.json({
      success: true,
      message: `সফলভাবে সিএসভি (CSV) ফাইল থেকে ${zodiacData.length}টি রাশির তথ্য আপডেট করা হয়েছে!`,
    });
  } catch (error) {
    console.error("Bulk CSV process error:", error);
    return res.status(500).json({ error: "সিএসভি ফাইল প্রসেস করতে সার্ভার ব্যর্থ হয়েছে", details: error.message });
  }
}

module.exports = {
  login,
  logout,
  checkSession,
  createAdmin,
  getLogs,
  bulkUpdateCSV
};
