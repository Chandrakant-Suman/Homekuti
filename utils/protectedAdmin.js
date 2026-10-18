// The primary admin account can never lose its admin role or be deleted.
// Override with PROTECTED_ADMIN_EMAIL in .env if the address ever changes.
const PROTECTED_ADMIN_EMAIL = (process.env.PROTECTED_ADMIN_EMAIL || "homekuti247@gmail.com").trim().toLowerCase();

const isProtectedAdmin = user => Boolean(user?.email) && user.email.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL;

// Case-insensitive exact match for queries
const protectedEmailRegex = () =>
  new RegExp(`^\\s*${PROTECTED_ADMIN_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

/**
 * Self-heal on startup: if the primary admin exists but isn't an admin
 * (e.g. demoted before this guard existed), restore the role.
 */
async function ensureProtectedAdmin(User) {
  const res = await User.collection.updateOne(
    { email: protectedEmailRegex(), role: { $ne: "admin" } },
    { $set: { role: "admin" } }
  );
  if (res.modifiedCount > 0) {
    console.warn(`⚠️  Restored admin role for protected account ${PROTECTED_ADMIN_EMAIL}`);
  }
}

module.exports = { PROTECTED_ADMIN_EMAIL, isProtectedAdmin, protectedEmailRegex, ensureProtectedAdmin };
