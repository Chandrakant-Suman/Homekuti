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

  // Revenue
  const revenueAgg = await Booking.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;

  res.render("admin/dashboard", {
    totalUsers,
    totalListings,
    totalBookings,
    totalRevenue,
    recentBookings,
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
