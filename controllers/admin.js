const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const DeletedUser = require("../models/deletedUser");
const DeletedListing = require("../models/deletedListing");
const { archiveAndDeleteListing } = require("../utils/listingDeletion");
const { syncPendingRefunds } = require("../utils/refundSync");
const { isProtectedAdmin, PROTECTED_ADMIN_EMAIL } = require("../utils/protectedAdmin");

module.exports.dashboard = async (req, res) => {

  const [totalUsers, totalListings, totalBookings, recentBookings] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Booking.countDocuments({ paymentStatus: "paid" }),
    Booking.find({ paymentStatus: "paid" })
      .populate("user", "username email")
      .populate("listing", "title price")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // 💰 Revenue
  const revenueAgg = await Booking.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalPrice" }
      }
    }
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;

  // 📈 Revenue Trend
  const revenueTrend = await Booking.aggregate([
    {
      $match: {
        paymentStatus: "paid",
        createdAt: {
          $gte: new Date(Date.now() - 7 * 86400000)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%d %b", date: "$createdAt" }
        },
        revenue: { $sum: "$totalPrice" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 👤 User Growth
  const userGrowth = await User.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(Date.now() - 7 * 86400000)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%d %b", date: "$createdAt" }
        },
        users: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 🔥 Top Listings
  const bookingsPerListing = await Booking.aggregate([
    {
      $match: { paymentStatus: "paid" }
    },
    {
      $group: {
        _id: "$listing",
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "listings",
        localField: "_id",
        foreignField: "_id",
        as: "listing"
      }
    },
    { $unwind: "$listing" },
    {
      $project: {
        title: "$listing.title",
        count: 1
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // ✅ FINAL RENDER (THIS FIXES YOUR ERROR)
  res.render("admin/dashboard", {
    totalUsers,
    totalListings,
    totalBookings,
    totalRevenue,
    recentBookings,
    revenueTrend,
    userGrowth,
    bookingsPerListing
  });
};

module.exports.listUsers = async (req, res) => {
  const users = await User.find({}).lean();

  const pending = users.filter(u => u.deleteRequest?.status === "pending");
  const pendingIds = pending.map(u => u._id);
  const [openBookings, ownedListings] = await Promise.all([
    Booking.aggregate([
      { $match: { user: { $in: pendingIds }, status: { $in: ["upcoming", "active"] } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]),
    Listing.aggregate([
      { $match: { owner: { $in: pendingIds } } },
      { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]),
  ]);
  const toMap = rows => Object.fromEntries(rows.map(r => [r._id.toString(), r.count]));
  const bookingCounts = toMap(openBookings);
  const listingCounts = toMap(ownedListings);

  const deleteRequests = pending
    .map(u => ({
      ...u,
      openBookings: bookingCounts[u._id.toString()] || 0,
      ownedListings: listingCounts[u._id.toString()] || 0,
    }))
    .sort((a, b) => new Date(a.deleteRequest.requestedAt) - new Date(b.deleteRequest.requestedAt));

  const deletedUsers = await DeletedUser.find({}).sort({ deletedAt: -1 }).lean();

  res.render("admin/users", { users, deleteRequests, deletedUsers, protectedAdminEmail: PROTECTED_ADMIN_EMAIL });
};

// Keep a minimal record (no credentials/contact extras) before removing the account
async function archiveAndDeleteUser(user, { method, admin }) {
  const archived = await DeletedUser.create({
    originalId: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    joinedAt: user.createdAt,
    method,
    reason: user.deleteRequest?.reason || undefined,
    requestedAt: user.deleteRequest?.requestedAt || undefined,
    deletedBy: { id: admin._id, username: admin.username },
  });
  try {
    await Review.deleteMany({ author: user._id });
    await User.findByIdAndDelete(user._id);
  } catch (err) {
    // Roll back the archive entry so the record isn't marked deleted while the account still exists
    await DeletedUser.findByIdAndDelete(archived._id);
    throw err;
  }
}

module.exports.approveDeleteRequest = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.deleteRequest?.status !== "pending") {
    req.flash("error", "No pending deletion request for this user.");
    return res.redirect("/admin/users");
  }
  if (isProtectedAdmin(user)) {
    req.flash("error", `${PROTECTED_ADMIN_EMAIL} is the primary admin and can't be deleted.`);
    return res.redirect("/admin/users");
  }

  // Don't strand guests or listings: these must be resolved first
  const [openBookings, ownedListings] = await Promise.all([
    Booking.countDocuments({ user: user._id, status: { $in: ["upcoming", "active"] } }),
    Listing.countDocuments({ owner: user._id }),
  ]);
  if (openBookings > 0 || ownedListings > 0) {
    req.flash(
      "error",
      `Cannot delete ${user.username} yet: ${openBookings} upcoming/active booking(s) and ${ownedListings} listing(s) must be cancelled or removed first.`
    );
    return res.redirect("/admin/users");
  }

  await archiveAndDeleteUser(user, { method: "request", admin: req.user });
  req.flash("success", `Account ${user.username} deleted. A minimal record was kept under Deleted Accounts.`);
  res.redirect("/admin/users");
};

module.exports.rejectDeleteRequest = async (req, res) => {
  await User.updateOne(
    { _id: req.params.id, "deleteRequest.status": "pending" },
    { $set: { "deleteRequest.status": "rejected", "deleteRequest.reviewedAt": new Date() } }
  );
  req.flash("success", "Deletion request rejected.");
  res.redirect("/admin/users");
};

const ROLES = ["user", "owner", "admin"];

module.exports.changeRole = async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) {
    req.flash("error", "Invalid role");
    return res.redirect("/admin/users");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    req.flash("error", "User not found");
    return res.redirect("/admin/users");
  }
  if (user.role === role) return res.redirect("/admin/users");

  if (isProtectedAdmin(user)) {
    req.flash("error", `${PROTECTED_ADMIN_EMAIL} is the primary admin and must stay an admin.`);
    return res.redirect("/admin/users");
  }
  if (user._id.equals(req.user._id)) {
    req.flash("error", "You can't change your own role. Ask another admin.");
    return res.redirect("/admin/users");
  }
  // Never leave the site without an admin
  if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    req.flash("error", "This is the only admin. Promote someone else before changing this role.");
    return res.redirect("/admin/users");
  }

  user.role = role;
  await user.save();
  req.flash("success", `${user.username} is now ${role === "admin" ? "an admin" : `a${role === "owner" ? "n" : ""} ${role}`}.`);
  res.redirect("/admin/users");
};

module.exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    req.flash("error", "User not found");
    return res.redirect("/admin/users");
  }
  if (isProtectedAdmin(user)) {
    req.flash("error", `${PROTECTED_ADMIN_EMAIL} is the primary admin and can't be deleted.`);
    return res.redirect("/admin/users");
  }
  if (user._id.equals(req.user._id)) {
    req.flash("error", "You can't delete your own admin account.");
    return res.redirect("/admin/users");
  }
  if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    req.flash("error", "You can't delete the only admin.");
    return res.redirect("/admin/users");
  }
  await archiveAndDeleteUser(user, { method: "admin", admin: req.user });
  req.flash("success", "User deleted");
  res.redirect("/admin/users");
};

module.exports.listListings = async (req, res) => {
  const [listings, deletedListings] = await Promise.all([
    Listing.find({}).populate("owner", "username").lean(),
    DeletedListing.find({}).sort({ deletedAt: -1 }).lean(),
  ]);
  res.render("admin/listings", { listings, deletedListings });
};

module.exports.deleteListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/admin/listings");
  }
  await archiveAndDeleteListing(listing, { method: "admin", deletedBy: req.user });
  req.flash("success", "Listing deleted. A minimal record was kept under Deleted Listings.");
  res.redirect("/admin/listings");
};

module.exports.listBookings = async (req, res) => {
  // Bring "refund initiated" rows up to date with Razorpay before showing them
  await syncPendingRefunds();
  const bookings = await Booking.find({})
    .populate("user", "username email")
    .populate("listing", "title location")
    .sort({ createdAt: -1 })
    .lean();
  res.render("admin/bookings", { bookings });
};

module.exports.deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (review) {
    await Listing.findOneAndUpdate(
      { reviews: review._id },
      { $pull: { reviews: review._id } }
    );
  }
  req.flash("success", "Review deleted");
  res.redirect("back");
};
