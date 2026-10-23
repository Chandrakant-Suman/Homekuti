const Booking = require("../models/booking");
const Review = require("../models/review");
const { ensureFreshStatuses } = require("./bookingLifecycle");

/**
 * Can `user` review `listing`? Returns:
 *   { eligible: true, booking }                  → the completed stay to attach the review to
 *   { eligible: false, reason, message }         → reason: "owner" | "no_stay" | "already_reviewed"
 */
async function getReviewEligibility(user, listing) {
  if (!user) return { eligible: false, reason: "signed_out", message: "Sign in to leave a review." };
  const ownerId = listing.owner?._id || listing.owner;
  if (ownerId && ownerId.equals(user._id)) {
    return { eligible: false, reason: "owner", message: "Hosts can't review their own listing." };
  }

  await ensureFreshStatuses();   // a stay that just ended should count
  const completed = await Booking.find({ user: user._id, listing: listing._id, status: "completed" })
    .sort({ checkOut: -1 })
    .select("_id checkIn checkOut")
    .lean();
  if (!completed.length) {
    return {
      eligible: false,
      reason: "no_stay",
      message: "Only guests who have completed a stay here can leave a review.",
    };
  }

  // Most recent completed stay that hasn't been reviewed yet
  const reviewed = await Review.find({ booking: { $in: completed.map(b => b._id) } }).distinct("booking");
  const reviewedSet = new Set(reviewed.map(String));
  const booking = completed.find(b => !reviewedSet.has(String(b._id)));
  if (!booking) {
    return { eligible: false, reason: "already_reviewed", message: "You've already reviewed your stay here. Thank you!" };
  }
  return { eligible: true, booking };
}

module.exports = { getReviewEligibility };
