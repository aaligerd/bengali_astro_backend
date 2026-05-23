const crypto = require("crypto");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "default-fallback-secret-key-123456";

/**
 * Signs a payload and returns a token string.
 * @param {object} payload - The token data payload
 * @param {number} expiresInMs - Expiration duration in milliseconds (default 1 day = 24h)
 * @returns {string} Signed token
 */
function signToken(payload, expiresInMs = 24 * 60 * 60 * 1000) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + expiresInMs,
    })
  ).toString("base64url");
  
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
    
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a token and returns the decoded payload, or null if invalid/expired.
 * @param {string} token - The signed token string
 * @returns {object|null} Decoded payload or null
 */
function verifyToken(token) {
  if (!token) return null;
  
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  
  const [header, body, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
    
  if (signature !== expectedSignature) {
    return null; // Signature mismatch
  }
  
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    
    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Token expired
    }
    
    return payload;
  } catch (e) {
    return null; // Parse error
  }
}

module.exports = {
  signToken,
  verifyToken
};
