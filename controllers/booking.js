const Booking = require("../models/booking");
const Listing = require("../models/listing");

module.exports.myBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("bookings/my-bookings", { bookings });
};

module.exports.bookingDetail = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }

  // Only booking owner or admin can view
  if (!booking.user._id.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied");
    return res.redirect("/bookings/my");
  }

  res.render("bookings/detail", { booking });
};

module.exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }

  if (!booking.user.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied");
    return res.redirect("/bookings/my");
  }

  // Only cancel upcoming bookings
  if (booking.status !== "upcoming") {
    req.flash("error", "Only upcoming bookings can be cancelled");
    return res.redirect("/bookings/my");
  }

  booking.status = "cancelled";
  await booking.save();

  req.flash("success", "Booking cancelled successfully");
  res.redirect("/bookings/my");
};

module.exports.createBooking = async (req, res) => {
  // This is handled by payment/verify — kept as fallback
  req.flash("error", "Please use the payment flow to book");
  res.redirect("/listings");
};
