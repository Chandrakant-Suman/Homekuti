const Joi = require("joi");
const ExpressError = require("../utils/ExpressError");

const listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().min(3).required(),
    description: Joi.string().min(10).required(),
    price: Joi.number().min(1).required(),
    location: Joi.string().min(2).required(),
    country: Joi.string().min(2).required(),
    genre: Joi.string().valid("Beach","Mountain","City","Luxury","Budget","Heritage","Forest","Countryside","Island","Desert").optional(),
    image: Joi.any().optional(),
  }).required(),
});

module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const msg = error.details.map(d => d.message).join(", ");
    throw new ExpressError(400,msg);
  }
  next();
};
