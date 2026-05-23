const express = require("express");
const { getHoroscopes, saveHoroscopes } = require("../controllers/horoscopeController");
const { authenticateAdmin } = require("../middlewares/auth");

const router = express.Router();

router.get("/horoscope", getHoroscopes);
router.post("/horoscope", authenticateAdmin, saveHoroscopes);

module.exports = router;
