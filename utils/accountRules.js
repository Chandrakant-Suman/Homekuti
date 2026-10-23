// Account rules shared by sign-up, profile updates and password reset.

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
// Pragmatic check: something@something.tld, no spaces
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalizeEmail = email => (typeof email === "string" ? email.trim().toLowerCase() : "");

/** Returns an error message, or null if the password is acceptable. */
function passwordProblem(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

/**
 * Validate sign-up input. Returns { values, errors } where errors maps
 * field → message (empty object when valid). Uniqueness is checked separately.
 */
function validateSignup({ username, email, password } = {}) {
  const values = {
    username: typeof username === "string" ? username.trim() : "",
    email: normalizeEmail(email),
  };
  const errors = {};
  if (!USERNAME_RE.test(values.username)) {
    errors.username = "3–30 characters: letters, numbers, dots or underscores.";
  }
  if (!EMAIL_RE.test(values.email) || values.email.length > 254) {
    errors.email = "Enter a valid email address.";
  }
  const pw = passwordProblem(password);
  if (pw) errors.password = pw;
  return { values, errors };
}

// Accounts created before email verification existed have no flag → treated as verified
const isEmailVerified = user => Boolean(user) && user.emailVerified !== false;

module.exports = {
  USERNAME_RE,
  MIN_PASSWORD_LENGTH,
  EMAIL_RE,
  normalizeEmail,
  passwordProblem,
  validateSignup,
  isEmailVerified,
};
