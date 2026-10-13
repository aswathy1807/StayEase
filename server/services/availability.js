const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const { nightsBetween } = require('../utils/dates');

async function availableUnits(room, dates) {
  const rows = await RoomNight.find({
    room: room._id,
    date: { $in: dates }
  }).select('date unit booking').lean();
  const activeIds = await Booking.find({
    _id: { $in: rows.map((row) => row.booking) },
    status: 'confirmed'
  }).distinct('_id');
  const activeSet = new Set(activeIds.map((id) => id.toString()));
  const occupied = new Set(rows
    .filter((row) => activeSet.has(row.booking.toString()))
    .map((row) => `${row.date.toISOString().slice(0, 10)}:${row.unit}`));
  const free = [];
  for (let unit = 0; unit < room.quantity; unit += 1) {
    if (dates.every((date) => !occupied.has(`${date.toISOString().slice(0, 10)}:${unit}`))) free.push(unit);
  }
  return free;
}

async function isRoomAvailable(room, checkIn, checkOut) {
  return (await availableUnits(room, nightsBetween(checkIn, checkOut))).length > 0;
}

module.exports = { availableUnits, isRoomAvailable };
