const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  capacity: { type: Number, required: true, min: 1, max: 20 },
  pricePerNight: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 1, max: 100 },
  amenities: [{ type: String, trim: true }]
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
