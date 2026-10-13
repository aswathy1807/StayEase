const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value, field) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    const error = new Error(`${field} must be a valid date in YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return date;
}

function getStay(checkInValue, checkOutValue) {
  const checkIn = parseDate(checkInValue, 'checkIn');
  const checkOut = parseDate(checkOutValue, 'checkOut');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (checkIn < today) {
    const error = new Error('Check-in cannot be in the past');
    error.status = 400;
    throw error;
  }
  const nights = (checkOut - checkIn) / DAY_MS;
  if (nights < 1 || nights > 30) {
    const error = new Error('Stay must be between 1 and 30 nights');
    error.status = 400;
    throw error;
  }
  return { checkIn, checkOut, nights };
}

function nightsBetween(checkIn, checkOut) {
  const dates = [];
  for (let date = new Date(checkIn); date < checkOut; date = new Date(date.getTime() + DAY_MS)) {
    dates.push(date);
  }
  return dates;
}

module.exports = { getStay, nightsBetween, parseDate };
