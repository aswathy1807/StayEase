require('dotenv').config({ path: '.env.test' });
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../server/app');
const User = require('../server/models/User');
const Hotel = require('../server/models/Hotel');
const Room = require('../server/models/Room');
const Booking = require('../server/models/Booking');
const RoomNight = require('../server/models/RoomNight');

const config = {
  PORT: 3000,
  MONGODB_URI: '',
  JWT_SECRET: 'a-test-secret-with-more-than-thirty-two-characters',
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:3000'
};
let mongo;
let app;
let hotel;
let room;

function dayOffset(offset) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function register(email, name = 'Test Guest') {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({ name, email, password: 'secure-password-123' });
  assert.equal(response.status, 201);
  return agent;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([RoomNight.init(), User.init()]);
  app = createApp(config);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  hotel = await Hotel.create({
    name: 'Test Hotel',
    location: 'Lisbon',
    country: 'Portugal',
    description: 'A comfortable and thoughtfully designed test hotel.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    rating: 4.8,
    amenities: ['Wi-Fi']
  });
  room = await Room.create({
    hotel: hotel._id,
    name: 'Garden Room',
    capacity: 2,
    pricePerNight: 125,
    quantity: 1,
    amenities: ['Queen bed']
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('registration hashes passwords and protects authenticated profile', async () => {
  const agent = await register('guest@example.com');
  const user = await User.findOne({ email: 'guest@example.com' }).select('+passwordHash');
  assert.ok(user.passwordHash);
  assert.notEqual(user.passwordHash, 'secure-password-123');
  const profile = await agent.get('/api/auth/me');
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.email, 'guest@example.com');
  const denied = await request(app).get('/api/auth/me');
  assert.equal(denied.status, 401);
  const logout = await agent.post('/api/auth/logout');
  assert.equal(logout.status, 200);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('serves the booking UI and restricts hotel management to administrators', async () => {
  const page = await request(app).get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /StayEase/);

  const guest = await register('regular@example.com');
  const hotelData = {
    name: 'New Test Stay',
    location: 'Porto',
    country: 'Portugal',
    description: 'A welcoming hotel for an integration test.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    rating: 4.6,
    amenities: ['Wi-Fi']
  };
  assert.equal((await guest.post('/api/hotels').send(hotelData)).status, 403);

  await User.create({
    name: 'Test Admin',
    email: 'admin@example.com',
    passwordHash: await User.hashPassword('admin-password-123'),
    role: 'admin'
  });
  const admin = request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin-password-123' })).status, 200);
  const created = await admin.post('/api/hotels').send(hotelData);
  assert.equal(created.status, 201);
  const createdRoom = await admin.post(`/api/hotels/${created.body.hotel._id}/rooms`).send({
    name: 'Porto Suite',
    capacity: 2,
    pricePerNight: 180,
    quantity: 2
  });
  assert.equal(createdRoom.status, 201);
  const updatedRoom = await admin.patch(`/api/rooms/${createdRoom.body.room._id}`).send({ pricePerNight: 195 });
  assert.equal(updatedRoom.body.room.pricePerNight, 195);
});

test('hotel search filters destinations and availability changes with reservations', async () => {
  const initial = await request(app).get('/api/hotels').query({
    destination: 'lisbon',
    checkIn: dayOffset(5),
    checkOut: dayOffset(7),
    guests: 2
  });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.hotels.length, 1);
  assert.equal(initial.body.hotels[0].startingPrice, 125);

  const guest = await register('search@example.com');
  const booked = await guest.post('/api/bookings').send({
    roomId: room._id.toString(),
    checkIn: dayOffset(5),
    checkOut: dayOffset(7),
    guests: 2
  });
  assert.equal(booked.status, 201);
  const noAvailability = await request(app).get('/api/hotels').query({
    destination: 'lisbon',
    checkIn: dayOffset(5),
    checkOut: dayOffset(7),
    guests: 2
  });
  assert.equal(noAvailability.body.hotels.length, 0);
});

test('concurrent requests cannot oversell; cancellation releases availability', async () => {
  const guestA = await register('one@example.com');
  const guestB = await register('two@example.com');
  room.pricePerNight = 125.25;
  await room.save();
  const payload = { roomId: room._id.toString(), checkIn: dayOffset(12), checkOut: dayOffset(14), guests: 2, totalPrice: 1 };
  const results = await Promise.all([
    guestA.post('/api/bookings').send(payload),
    guestB.post('/api/bookings').send(payload)
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await Booking.countDocuments({ status: 'confirmed' }), 1);
  const winner = results.find((result) => result.status === 201);
  const winnerAgent = results[0] === winner ? guestA : guestB;
  assert.equal(winner.body.booking.totalPrice, 250.5);
  assert.equal(winner.body.booking.nights, 2);
  const cancellation = await winnerAgent.patch(`/api/bookings/${winner.body.booking._id}/cancel`);
  assert.equal(cancellation.status, 200);
  assert.equal(await RoomNight.countDocuments(), 0);
  const available = await request(app).get('/api/hotels').query({
    destination: 'lisbon',
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    guests: 2
  });
  assert.equal(available.body.hotels.length, 1);
});

test('rejects invalid stays and prevents users from cancelling another guest booking', async () => {
  const owner = await register('owner@example.com');
  const stranger = await register('stranger@example.com');
  const invalid = await owner.post('/api/bookings').send({
    roomId: room._id.toString(),
    checkIn: dayOffset(8),
    checkOut: dayOffset(8),
    guests: 2
  });
  assert.equal(invalid.status, 400);
  const booking = await owner.post('/api/bookings').send({
    roomId: room._id.toString(),
    checkIn: dayOffset(8),
    checkOut: dayOffset(9),
    guests: 2
  });
  const denied = await stranger.patch(`/api/bookings/${booking.body.booking._id}/cancel`);
  assert.equal(denied.status, 404);
});
