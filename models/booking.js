const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
  },
  nights: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: [
      "pending",
      "paid",
      "failed",
      "refund_initiated",
      "refunded",
      "refund_failed",
    ],
    default: "pending",
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  status: {
    type: String,
    enum: ["upcoming", "active", "completed", "cancelled", "unavailable"],
    default: "upcoming",
  },

  // ── Cancellation record ────────────────────────────────
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ["user", "host", "admin"],
    },
    cancelledAt: Date,
    reason: String,
    policyApplied: {
      type: String,
      enum: ["full", "partial", "none"],
    },
  },

  // ── Refund record ──────────────────────────────────────
  refund: {
    razorpayRefundId: String,
    amount: Number,
    percentage: Number,
    reason: {
      type: String,
      enum: ["user_cancel", "host_unavailable", "admin"],
    },
    status: {
      type: String,
      enum: ["initiated", "processed", "failed"],
    },
    initiatedAt: Date,
    processedAt: Date,
    failureReason: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ listing: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ razorpayOrderId: 1 });
bookingSchema.index({ "refund.razorpayRefundId": 1 });

/* ─────────────────────────────────────────────────────────
 * CANCELLATION / REFUND POLICY
 *
 * Tiers are measured from "now" to the check-in date:
 *
 *   ≥ 7 days before check-in ............ 100% refund
 *   24 hours – 7 days before check-in ...  50% refund
 *   < 24 hours before check-in ..........   0% refund
 *
 * The percentages MUST stay 100 / 50 / 0 — controllers and
 * views branch on those exact values when deciding whether
 * the applied policy was "full", "partial" or "none".
 * ───────────────────────────────────────────────────────── */
const FULL_REFUND_HOURS = 24 * 7; // 168 hours
const PARTIAL_REFUND_HOURS = 24;

bookingSchema.methods.getRefundPolicy = function (now = new Date()) {
  // Guard: a booking with no check-in date can't be evaluated.
  if (!this.checkIn) {
    return {
      percentage: 0,
      hoursUntilCheckIn: 0,
      label: "No refund",
      description:
        "This booking has no check-in date on record, so no automatic refund can be calculated. Please contact support.",
    };
  }

  const msUntilCheckIn = this.checkIn.getTime() - now.getTime();
  const hoursUntilCheckIn = msUntilCheckIn / (1000 * 60 * 60);

  // Already checked in, or stay is over — no automatic refund.
  if (hoursUntilCheckIn <= 0) {
    return {
      percentage: 0,
      hoursUntilCheckIn: 0,
      label: "No refund",
      description:
        "The check-in date has already passed, so this booking is no longer eligible for an automatic refund.",
    };
  }

  if (hoursUntilCheckIn >= FULL_REFUND_HOURS) {
    return {
      percentage: 100,
      hoursUntilCheckIn,
      label: "Full refund",
      description:
        "You're cancelling more than 7 days before check-in, so you get your full amount back.",
    };
  }

  if (hoursUntilCheckIn >= PARTIAL_REFUND_HOURS) {
    return {
      percentage: 50,
      hoursUntilCheckIn,
      label: "Partial refund (50%)",
      description:
        "You're cancelling within 7 days of check-in, so half the amount is refunded and half is retained as a cancellation fee.",
    };
  }

  return {
    percentage: 0,
    hoursUntilCheckIn,
    label: "No refund",
    description:
      "You're cancelling within 24 hours of check-in, so no refund applies under our cancellation policy.",
  };
};

/**
 * Rupee value that would be refunded if this booking were
 * cancelled right now. Kept next to the policy so the rounding
 * rule lives in exactly one place.
 */
bookingSchema.methods.getRefundAmount = function (now = new Date()) {
  const { percentage } = this.getRefundPolicy(now);
  return Math.round((this.totalPrice * percentage) / 100);
};

module.exports = mongoose.model("Booking", bookingSchema);
