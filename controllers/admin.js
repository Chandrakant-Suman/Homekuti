const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");

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
  res.render("admin/users", { users });
};

module.exports.changeRole = async (req, res) => {
  const { role } = req.body;
  await User.findByIdAndUpdate(req.params.id, { role });
  req.flash("success", "User role updated");
  res.redirect("/admin/users");
};

module.exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  req.flash("success", "User deleted");
  res.redirect("/admin/users");
};

module.exports.listListings = async (req, res) => {
  const listings = await Listing.find({}).populate("owner", "username").lean();
  res.render("admin/listings", { listings });
};

module.exports.deleteListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted");
  res.redirect("/admin/listings");
};

module.exports.listBookings = async (req, res) => {
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
