/**
 * Helper to trigger revalidation on Next.js frontend.
 */
async function triggerFrontendRevalidation() {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5050";
  const secret = process.env.REVALIDATE_SECRET || "super-secret-revalidate-token";
  try {
    const res = await fetch(`${frontendUrl}/api/revalidate?secret=${secret}`, {
      method: "POST"
    });
    if (!res.ok) {
      console.error("Next.js revalidation failed:", res.status, await res.text());
    } else {
      console.log("Next.js cache revalidation triggered successfully.");
    }
  } catch (error) {
    console.error("Failed to connect to Next.js revalidation endpoint:", error);
  }
}

module.exports = {
  triggerFrontendRevalidation
};
