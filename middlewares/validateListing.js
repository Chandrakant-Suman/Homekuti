const ExpressError = require("../utils/ExpressError");

// listing schema definition using Joi
const Joi = require("joi");
const listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().min(20).required(),
    price: Joi.number().min(500).required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
  }).required()
});

// middleware to validate listing data
module.exports.validateListing = (req, res, next) => {

  const { error } = listingSchema.validate(req.body, {
    allowUnknown: true
  });

  if (error) {
    const msg = error.details.map(el => el.message).join(",");
    throw new ExpressError(400, msg);
  }

  next();
};
