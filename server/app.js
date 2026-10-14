const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Room = require('./models/Room');
const Booking = require('./models/Booking');
const RoomNight = require('./models/RoomNight');
const { createAuthMiddleware } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errors');
const { getStay } = require('./utils/dates');
const { isRoomAvailable } = require('./services/availability');
const { reserveRoom } = require('./services/reservations');
const { initializeDatabase } = require('./db');

const hotelInput = z.object({
  name: z.string().trim().min(2).max(140),
  location: z.string().trim().min(2).max(140),
  country: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(3000),
  image: z.string().url().refine((value) => value.startsWith('https://'), 'Image URL must use HTTPS'),
  rating: z.coerce.number().min(0).max(5).optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  featured: z.boolean().optional()
});
const roomInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  capacity: z.coerce.number().int().min(1).max(20),
  pricePerNight: z.coerce.number().positive().max(1000000),
  quantity: z.coerce.number().int().min(1).max(100),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).optional()
});
const registrationInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(10).max(100)
});
const loginInput = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(100)
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function makeRouter(config) {
  const router = express.Router();
  const { authenticate, requireAdmin } = createAuthMiddleware(config.JWT_SECRET);

  function issueSession(res, user) {
    const token = jwt.sign({ sub: user._id.toString() }, config.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('stayease_token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  router.post('/auth/register', asyncRoute(async (req, res) => {
    const input = registrationInput.parse(req.body);
    const email = input.email.toLowerCase();
    const user = await User.create({
      name: input.name,
      email,
      passwordHash: await User.hashPassword(input.password)
    });
    issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  }));

  router.post('/auth/login', asyncRoute(async (req, res) => {
    const input = loginInput.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await user.verifyPassword(input.password))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    issueSession(res, user);
    return res.json({ user: publicUser(user) });
  }));

  router.post('/auth/logout', (req, res) => {
    res.clearCookie('stayease_token', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    res.json({ message: 'Signed out' });
  });

  router.get('/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

  router.get('/hotels', asyncRoute(async (req, res) => {
    const query = {};
    if (req.query.destination) {
      const destination = z.string().trim().min(1).max(120).parse(req.query.destination);
      const destinationPattern = { $regex: escapeRegex(destination), $options: 'i' };
      query.$or = [
        { location: destinationPattern },
        { country: destinationPattern },
        { name: destinationPattern }
      ];
    }
    if (req.query.minRating !== undefined) query.rating = { $gte: z.coerce.number().min(0).max(5).parse(req.query.minRating) };
    if (req.query.featuredOnly !== undefined) {
      const featuredOnly = z.enum(['true', 'false']).parse(req.query.featuredOnly);
      if (featuredOnly === 'true') query.featured = true;
    }
    let hotels = await Hotel.find(query).sort({ featured: -1, rating: -1 }).lean();
    const rooms = await Room.find({ hotel: { $in: hotels.map((hotel) => hotel._id) } }).lean();
    const guests = req.query.guests === undefined ? null : z.coerce.number().int().min(1).max(20).parse(req.query.guests);
    const minPrice = req.query.minPrice === undefined ? null : z.coerce.number().min(0).max(1000000).parse(req.query.minPrice);
    const maxPrice = req.query.maxPrice === undefined ? null : z.coerce.number().min(0).max(1000000).parse(req.query.maxPrice);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      throw Object.assign(new Error('Minimum price cannot exceed maximum price'), { status: 400 });
    }
    let stay = null;
    if (req.query.checkIn || req.query.checkOut) {
      if (!req.query.checkIn || !req.query.checkOut) throw Object.assign(new Error('Both check-in and check-out dates are required'), { status: 400 });
      stay = getStay(String(req.query.checkIn), String(req.query.checkOut));
    }
    const result = [];
    for (const hotel of hotels) {
      let hotelRooms = rooms.filter((room) => room.hotel.toString() === hotel._id.toString());
      if (guests) hotelRooms = hotelRooms.filter((room) => room.capacity >= guests);
      if (minPrice !== null) hotelRooms = hotelRooms.filter((room) => room.pricePerNight >= minPrice);
      if (maxPrice !== null) hotelRooms = hotelRooms.filter((room) => room.pricePerNight <= maxPrice);
      if (stay) {
        const checks = await Promise.all(hotelRooms.map(async (room) => ({
          room,
          available: await isRoomAvailable(room, stay.checkIn, stay.checkOut)
        })));
        hotelRooms = checks.filter((item) => item.available).map((item) => item.room);
      }
      const prices = hotelRooms.map((room) => room.pricePerNight);
      if (!prices.length) continue;
      const startingPrice = Math.min(...prices);
      result.push({ ...hotel, startingPrice, availableRoomCount: hotelRooms.length });
    }
    res.json({ hotels: result });
  }));

  router.get('/hotels/:id', asyncRoute(async (req, res) => {
    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const rooms = await Room.find({ hotel: hotel._id }).sort({ pricePerNight: 1 }).lean();
    const datesProvided = req.query.checkIn || req.query.checkOut;
    const guests = req.query.guests === undefined ? null : z.coerce.number().int().min(1).max(20).parse(req.query.guests);
    let stay = null;
    if (datesProvided) {
      if (!req.query.checkIn || !req.query.checkOut) throw Object.assign(new Error('Both check-in and check-out dates are required'), { status: 400 });
      stay = getStay(String(req.query.checkIn), String(req.query.checkOut));
    }
    const result = await Promise.all(rooms.map(async (room) => ({
      ...room,
      available: (guests === null || room.capacity >= guests)
        && (stay ? await isRoomAvailable(room, stay.checkIn, stay.checkOut) : true)
    })));
    return res.json({ hotel, rooms: result });
  }));

  router.post('/hotels', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const hotel = await Hotel.create(hotelInput.parse(req.body));
    res.status(201).json({ hotel });
  }));

  router.patch('/hotels/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const input = hotelInput.partial().parse(req.body);
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    return res.json({ hotel });
  }));

  router.delete('/hotels/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const rooms = await Room.find({ hotel: hotel._id }).select('_id');
    const activeBooking = await Booking.exists({ room: { $in: rooms.map((room) => room._id) }, status: 'confirmed' });
    if (activeBooking) return res.status(409).json({ error: 'This hotel has reservations and cannot be removed' });
    await Room.deleteMany({ hotel: hotel._id });
    await RoomNight.deleteMany({ room: { $in: rooms.map((room) => room._id) } });
    await Hotel.deleteOne({ _id: hotel._id });
    return res.json({ message: 'Hotel removed' });
  }));

  router.post('/hotels/:hotelId/rooms', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const hotel = await Hotel.findById(req.params.hotelId).select('_id');
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const room = await Room.create({ ...roomInput.parse(req.body), hotel: hotel._id });
    return res.status(201).json({ room });
  }));

  router.patch('/rooms/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const input = roomInput.partial().parse(req.body);
    const existing = await Room.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Room not found' });
    if (input.capacity !== undefined && input.capacity < existing.capacity) {
      const overCapacityBooking = await Booking.exists({
        room: existing._id,
        status: 'confirmed',
        checkOut: { $gt: new Date() },
        guests: { $gt: input.capacity }
      });
      if (overCapacityBooking) return res.status(409).json({ error: "Room capacity cannot be reduced below an active reservation's guest count" });
    }
    if (input.quantity !== undefined && input.quantity < existing.quantity) {
      const activeBooking = await Booking.exists({
        room: existing._id,
        status: 'confirmed',
        checkOut: { $gt: new Date() }
      });
      if (activeBooking) return res.status(409).json({ error: 'Room inventory cannot be reduced while reservations are active' });
    }
    const room = await Room.findByIdAndUpdate(existing._id, input, { new: true, runValidators: true });
    return res.json({ room });
  }));

  router.delete('/rooms/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const activeBooking = await Booking.exists({ room: room._id, status: 'confirmed' });
    if (activeBooking) return res.status(409).json({ error: 'This room has reservations and cannot be removed' });
    await RoomNight.deleteMany({ room: room._id });
    await Room.deleteOne({ _id: room._id });
    return res.json({ message: 'Room removed' });
  }));

  router.post('/bookings', authenticate, asyncRoute(async (req, res) => {
    const input = z.object({
      roomId: z.string().regex(/^[a-f\d]{24}$/i),
      checkIn: z.string(),
      checkOut: z.string(),
      guests: z.coerce.number().int().min(1).max(20)
    }).parse(req.body);
    const stay = getStay(input.checkIn, input.checkOut);
    const room = await Room.findById(input.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (input.guests > room.capacity) return res.status(400).json({ error: `This room accommodates up to ${room.capacity} guests` });
    const booking = await reserveRoom({
      userId: req.user._id,
      hotelId: room.hotel,
      room,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: input.guests,
      nights: stay.nights
    });
    const populated = await Booking.findById(booking._id).populate('hotel', 'name location image').populate('room', 'name');
    return res.status(201).json({ booking: populated });
  }));

  router.get('/bookings/mine', authenticate, asyncRoute(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('hotel', 'name location image')
      .populate('room', 'name')
      .sort({ checkIn: -1 });
    res.json({ bookings });
  }));

  router.get('/bookings', authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const bookings = await Booking.find()
      .populate('user', 'name email')
      .populate('hotel', 'name location')
      .populate('room', 'name')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  }));

  router.patch('/bookings/:id/cancel', authenticate, asyncRoute(async (req, res) => {
    const filter = { _id: req.params.id, status: 'confirmed' };
    if (req.user.role !== 'admin') filter.user = req.user._id;
    const booking = await Booking.findOne(filter);
    if (!booking) return res.status(404).json({ error: 'Active booking not found' });
    if (booking.checkIn <= new Date()) return res.status(409).json({ error: 'Bookings cannot be cancelled on or after check-in' });
    const cancelled = await Booking.findOneAndUpdate(filter, { status: 'cancelled' }, { new: true });
    if (!cancelled) return res.status(409).json({ error: 'This booking has already been changed' });
    await RoomNight.deleteMany({ booking: cancelled._id });
    return res.json({ booking: cancelled, message: 'Booking cancelled. No payment was collected in this demo.' });
  }));

  return router;
}

function createApp(config, app = express()) {
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:']
      }
    }
  }));
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api', (req, res, next) => {
    initializeDatabase(config.MONGODB_URI).then(() => next()).catch(next);
  });
  app.use('/api', makeRouter(config));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
