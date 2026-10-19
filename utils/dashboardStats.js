const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");

/*
 * Admin dashboard metrics.
 *
 * Finance rules (per booking where money was actually collected):
 *   collected   = totalPrice
 *   refundOut   = refund.amount if the refund is processed or in progress, else 0
 *                 (failed / cancelled refunds mean the money is still with us)
 *   retained    = collected - refundOut
 *   gstRetained = min(GST charged, retained)   — refunds come out of the non-GST part first
 *   net         = retained - gstRetained        — earnings, excluding tax owed
 *
 * Every section is computed independently: if one query fails, that section
 * shows an error state and the rest of the dashboard still renders.
 */

const TZ = "Asia/Kolkata";
const TREND_DAYS = 30;
const TOP_LISTINGS = 6;

// Payment statuses where money was captured at some point
const COLLECTED_STATUSES = ["paid", "refund_initiated", "refunded", "refund_failed", "refund_cancelled"];
const REFUND_OUT_STATUSES = ["refund_initiated", "refunded"];

const financeFields = [
  { $match: { paymentStatus: { $in: COLLECTED_STATUSES } } },
  {
    $addFields: {
      _refundOut: {
        $cond: [{ $in: ["$paymentStatus", REFUND_OUT_STATUSES] }, { $ifNull: ["$refund.amount", 0] }, 0],
      },
      _gst: { $ifNull: ["$priceBreakdown.gst", 0] },
    },
  },
  { $addFields: { _retained: { $max: [0, { $subtract: ["$totalPrice", "$_refundOut"] }] } } },
  { $addFields: { _gstRetained: { $min: ["$_gst", "$_retained"] } } },
  { $addFields: { _net: { $subtract: ["$_retained", "$_gstRetained"] } } },
];

// "YYYY-MM-DD" in IST for each of the last `days` days, oldest first
function lastNDays(days) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const out = [];
  for (let i = days - 1; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 86400000)));
  return out;
}

function fillDays(rows, days, valueKey) {
  const byDay = Object.fromEntries(rows.map(r => [r._id, r[valueKey]]));
  return lastNDays(days).map(day => ({
    day,
    label: new Date(`${day}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ }),
    value: byDay[day] || 0,
  }));
}

const windowStart = days => new Date(Date.now() - days * 86400000);

async function counts() {
  const [users, usersByRole, listings, bookingStatus, pendingDeletion] = await Promise.all([
    User.countDocuments(),
    User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
    Listing.countDocuments(),
    Booking.aggregate([
      { $match: { paymentStatus: { $in: COLLECTED_STATUSES } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    User.countDocuments({ "deleteRequest.status": "pending" }),
  ]);
  const byStatus = Object.fromEntries(bookingStatus.map(r => [r._id, r.n]));
  const roles = Object.fromEntries(usersByRole.map(r => [r._id, r.n]));
  return {
    users,
    owners: roles.owner || 0,
    admins: roles.admin || 0,
    listings,
    bookings: Object.values(byStatus).reduce((a, b) => a + b, 0),
    upcoming: (byStatus.upcoming || 0) + (byStatus.active || 0),
    completed: byStatus.completed || 0,
    cancelled: (byStatus.cancelled || 0) + (byStatus.unavailable || 0),
    pendingDeletion,
  };
}

async function finance() {
  const [totals] = await Booking.aggregate([
    ...financeFields,
    {
      $group: {
        _id: null,
        collected: { $sum: "$totalPrice" },
        refunded: { $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, "$_refundOut", 0] } },
        refundsInProgress: { $sum: { $cond: [{ $eq: ["$paymentStatus", "refund_initiated"] }, "$_refundOut", 0] } },
        refundsFailed: { $sum: { $cond: [{ $eq: ["$paymentStatus", "refund_failed"] }, 1, 0] } },
        gst: { $sum: "$_gstRetained" },
        net: { $sum: "$_net" },
      },
    },
  ]);
  return {
    collected: totals?.collected || 0,
    refunded: totals?.refunded || 0,
    refundsInProgress: totals?.refundsInProgress || 0,
    refundsFailed: totals?.refundsFailed || 0,
    gst: totals?.gst || 0,
    net: totals?.net || 0,
  };
}

async function earningsTrend() {
  const rows = await Booking.aggregate([
    ...financeFields,
    { $match: { createdAt: { $gte: windowStart(TREND_DAYS + 1) } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
        net: { $sum: "$_net" },
      },
    },
  ]);
  const days = fillDays(rows, TREND_DAYS, "net");
  return { days, total: days.reduce((a, d) => a + d.value, 0) };
}

async function userGrowth() {
  const rows = await User.aggregate([
    { $match: { createdAt: { $gte: windowStart(TREND_DAYS + 1) } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
        n: { $sum: 1 },
      },
    },
  ]);
  const days = fillDays(rows, TREND_DAYS, "n");
  return { days, total: days.reduce((a, d) => a + d.value, 0) };
}

async function earningsByListing() {
  const rows = await Booking.aggregate([
    ...financeFields,
    { $group: { _id: "$listing", net: { $sum: "$_net" }, bookings: { $sum: 1 } } },
    { $match: { net: { $gt: 0 } } },   // only listings that actually earned
    { $sort: { net: -1 } },
    { $lookup: { from: "listings", localField: "_id", foreignField: "_id", as: "live" } },
    { $lookup: { from: "deletedlistings", localField: "_id", foreignField: "originalId", as: "gone" } },
    {
      $project: {
        net: 1,
        bookings: 1,
        title: { $ifNull: [{ $first: "$live.title" }, { $first: "$gone.title" }] },
        deleted: { $eq: [{ $size: "$live" }, 0] },
      },
    },
  ]);
  const items = rows.map(r => ({
    title: (r.title || "Unknown listing") + (r.deleted ? " (deleted)" : ""),
    net: r.net,
    bookings: r.bookings,
  }));
  // Keep the chart readable: top N, everything else grouped
  const top = items.slice(0, TOP_LISTINGS);
  const rest = items.slice(TOP_LISTINGS);
  if (rest.length) {
    top.push({
      title: `Other (${rest.length})`,
      net: rest.reduce((a, r) => a + r.net, 0),
      bookings: rest.reduce((a, r) => a + r.bookings, 0),
    });
  }
  return { items: top, total: items.reduce((a, r) => a + r.net, 0) };
}

async function recentBookings() {
  return Booking.find({ paymentStatus: { $in: COLLECTED_STATUSES } })
    .populate("user", "username email")
    .populate("listing", "title")
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
}

const SECTIONS = { counts, finance, earningsTrend, userGrowth, earningsByListing, recentBookings };

/**
 * Returns { data: { section: value | null }, errors: [sectionName] }.
 */
async function getDashboardStats() {
  const names = Object.keys(SECTIONS);
  const results = await Promise.allSettled(names.map(n => SECTIONS[n]()));
  const data = {};
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      data[names[i]] = r.value;
    } else {
      data[names[i]] = null;
      errors.push(names[i]);
      console.error(`Dashboard section "${names[i]}" failed:`, r.reason);
    }
  });
  return { data, errors, trendDays: TREND_DAYS };
}

module.exports = { getDashboardStats };
