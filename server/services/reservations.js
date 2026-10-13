const mongoose = require('mongoose');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const { nightsBetween } = require('../utils/dates');
const { availableUnits } = require('./availability');

async function reserveRoom({ userId, hotelId, room, checkIn, checkOut, guests, nights }) {
  const dates = nightsBetween(checkIn, checkOut);
  const bookingId = new mongoose.Types.ObjectId();
  const totalPrice = Math.round(room.pricePerNight * nights * 100) / 100;
  if (!Number.isSafeInteger(Math.round(totalPrice * 100))) {
    const error = new Error('Booking total exceeds the supported amount');
    error.status = 400;
    throw error;
  }
  const booking = new Booking({
    _id: bookingId,
    user: userId,
    hotel: hotelId,
    room: room._id,
    checkIn,
    checkOut,
    guests,
    nights,
    pricePerNight: room.pricePerNight,
    totalPrice,
    status: 'confirmed'
  });
  await booking.save();

  try {
    const candidates = await availableUnits(room, dates);
    for (const unit of candidates) {
      try {
        await RoomNight.insertMany(dates.map((date) => ({
          room: room._id,
          date,
          unit,
          booking: bookingId
        })), { ordered: true });
        return booking;
      } catch (error) {
        await RoomNight.deleteMany({ booking: bookingId });
        if (error.code !== 11000) throw error;
      }
    }
    const error = new Error('That room is no longer available for the selected dates');
    error.status = 409;
    throw error;
  } catch (error) {
    await RoomNight.deleteMany({ booking: bookingId });
    await Booking.deleteOne({ _id: bookingId });
    throw error;
  }
}

module.exports = { reserveRoom };
