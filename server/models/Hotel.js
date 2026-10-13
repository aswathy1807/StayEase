const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  location: { type: String, required: true, trim: true, maxlength: 140 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  image: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 4.5 },
  amenities: [{ type: String, trim: true }],
  featured: { type: Boolean, default: false }
}, { timestamps: true });

hotelSchema.index({ location: 1 });

module.exports = mongoose.model('Hotel', hotelSchema);
