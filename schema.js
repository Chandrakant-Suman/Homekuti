// schema.js
const Joi = require("joi");

const listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().min(50).required(),
    price: Joi.number().min(500).required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    image: Joi.string().allow("", null)
  }).required()
});

module.exports = { listingSchema };
