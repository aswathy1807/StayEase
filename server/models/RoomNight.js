const mongoose = require('mongoose');

const roomNightSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: Date, required: true },
  unit: { type: Number, required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true }
}, { timestamps: true });

roomNightSchema.index({ room: 1, date: 1, unit: 1 }, { unique: true });
roomNightSchema.index({ booking: 1 });

module.exports = mongoose.model('RoomNight', roomNightSchema);
