const { verifyToken } = require("../jwt");

/**
 * Middleware to authenticate requests using HttpOnly session cookies.
 */
function authenticateAdmin(req, res, next) {
  const token = req.cookies.astro_session;
  if (!token) {
    return res.status(401).json({ error: "অননুমোদিত প্রবেশ" });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.username) {
    return res.status(401).json({ error: "অননুমোদিত প্রবেশ" });
  }

  req.adminUsername = decoded.username;
  next();
}

module.exports = {
  authenticateAdmin
};
