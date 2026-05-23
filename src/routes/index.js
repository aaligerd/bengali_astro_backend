const express = require("express");
const healthRoutes = require("./healthRoutes");
const horoscopeRoutes = require("./horoscopeRoutes");
const adminRoutes = require("./adminRoutes");

const router = express.Router();

// Mount all route modules
router.use(healthRoutes);
router.use(horoscopeRoutes);
router.use(adminRoutes);

module.exports = router;
