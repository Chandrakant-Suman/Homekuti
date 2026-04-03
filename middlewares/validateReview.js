const Joi = require("joi");
const ExpressError = require("../utils/ExpressError");

const reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().min(2).required(),
  }).required(),
});

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map(d => d.message).join(", ");
    throw new ExpressError(400, msg);
  }
  next();
};
