// Listing verification rules, kept in one place.

// Changing any of these means the property an admin inspected may no longer
// be the one advertised, so the listing has to be verified again.
const REVERIFY_FIELDS = ["title", "location", "country"];

const isVerified = listing => listing?.verification?.status === "verified";

// Missing status (listings created before this feature) counts as pending
const statusOf = listing => listing?.verification?.status || "pending";

/**
 * Which verification-relevant fields an owner's edit changed.
 * `before` / `after` are plain field values; `imageChanged` is a boolean.
 */
function reverifyReasons(before, after, imageChanged = false) {
  const changed = REVERIFY_FIELDS.filter(
    f => String(before[f] ?? "").trim() !== String(after[f] ?? "").trim()
  );
  if (imageChanged) changed.push("photo");
  return changed;
}

/** Put a listing back in the admin queue (mutates the document). */
function markPending(listing, note) {
  listing.verification = {
    status: "pending",
    requestedAt: new Date(),
    note,
  };
}

module.exports = { REVERIFY_FIELDS, isVerified, statusOf, reverifyReasons, markPending };
