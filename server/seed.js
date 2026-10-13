require('dotenv').config();
const { loadConfig } = require('./config');
const { connectDatabase } = require('./db');
const mongoose = require('mongoose');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Room = require('./models/Room');
const RoomNight = require('./models/RoomNight');

const sampleHotels = [
  {
    name: 'The Azure House',
    location: 'Santorini',
    country: 'Greece',
    description: 'A serene cliffside retreat with whitewashed suites, sweeping caldera views and warm, attentive hospitality.',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=85',
    rating: 4.9,
    amenities: ['Infinity pool', 'Sea view', 'Spa', 'Breakfast', 'Free Wi-Fi'],
    featured: true,
    rooms: [
      { name: 'Caldera King Suite', description: 'A private terrace overlooking the Aegean.', capacity: 2, pricePerNight: 420, quantity: 4, amenities: ['King bed', 'Private terrace', 'Sea view'] },
      { name: 'Horizon Family Suite', description: 'Room to unwind with a separate lounge.', capacity: 4, pricePerNight: 590, quantity: 2, amenities: ['King bed', 'Sofa bed', 'Sea view'] }
    ]
  },
  {
    name: 'Maison Lumière',
    location: 'Paris',
    country: 'France',
    description: 'An elegant city hideaway moments from the Left Bank, pairing considered design with the ease of a neighborhood home.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85',
    rating: 4.8,
    amenities: ['Restaurant', 'City view', 'Concierge', 'Free Wi-Fi'],
    featured: true,
    rooms: [
      { name: 'Classic Atelier', description: 'A light-filled room with bespoke Parisian details.', capacity: 2, pricePerNight: 245, quantity: 8, amenities: ['Queen bed', 'Rain shower'] },
      { name: 'Grand Corner Suite', description: 'A spacious suite with a separate sitting room.', capacity: 3, pricePerNight: 380, quantity: 3, amenities: ['King bed', 'Sitting room', 'City view'] }
    ]
  },
  {
    name: 'Sora Garden Retreat',
    location: 'Kyoto',
    country: 'Japan',
    description: 'A tranquil contemporary ryokan framed by a garden, with thoughtful service and easy access to historic Kyoto.',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=85',
    rating: 4.9,
    amenities: ['Garden', 'Onsen', 'Restaurant', 'Free Wi-Fi'],
    featured: true,
    rooms: [
      { name: 'Garden Tatami Room', description: 'A calm traditional room with a private garden outlook.', capacity: 2, pricePerNight: 285, quantity: 5, amenities: ['Tatami lounge', 'Garden view', 'Deep soaking tub'] },
      { name: 'Sora Residence', description: 'A generous residence for a small family or group.', capacity: 4, pricePerNight: 440, quantity: 2, amenities: ['King bed', 'Tatami lounge', 'Garden view'] }
    ]
  },
  {
    name: 'Casa Maré',
    location: 'Lisbon',
    country: 'Portugal',
    description: 'A sunlit boutique stay in the heart of Lisbon, where local craft and coastal color meet effortless comfort.',
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1400&q=85',
    rating: 4.7,
    amenities: ['Rooftop terrace', 'Breakfast', 'Bar', 'Free Wi-Fi'],
    featured: false,
    rooms: [
      { name: 'Alfama Double', description: 'A welcoming room inspired by the colors of the old town.', capacity: 2, pricePerNight: 175, quantity: 10, amenities: ['Queen bed', 'Balcony'] },
      { name: 'Terrace Junior Suite', description: 'A private outdoor space above the rooftops.', capacity: 3, pricePerNight: 260, quantity: 3, amenities: ['King bed', 'Private terrace', 'City view'] }
    ]
  },
  {
    name: 'The Wild Fern',
    location: 'Ubud',
    country: 'Indonesia',
    description: 'A secluded jungle sanctuary with open-air living, restorative rituals and a pool immersed in tropical greenery.',
    image: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=85',
    rating: 4.8,
    amenities: ['Jungle pool', 'Spa', 'Yoga', 'Restaurant'],
    featured: false,
    rooms: [
      { name: 'Fern Pool Villa', description: 'A private plunge pool surrounded by lush planting.', capacity: 2, pricePerNight: 330, quantity: 6, amenities: ['Private pool', 'King bed', 'Garden shower'] },
      { name: 'Canopy Family Villa', description: 'A two-bedroom villa made for slow family days.', capacity: 4, pricePerNight: 510, quantity: 2, amenities: ['Private pool', 'Two bedrooms', 'Living room'] }
    ]
  },
  {
    name: 'Northline House',
    location: 'Copenhagen',
    country: 'Denmark',
    description: 'A quiet design-led base in the city, with natural materials, thoughtful comforts and a lively café downstairs.',
    image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=85',
    rating: 4.6,
    amenities: ['Cafe', 'Bicycles', 'Gym', 'Free Wi-Fi'],
    featured: false,
    rooms: [
      { name: 'Nordic Double', description: 'Minimal, warm and perfectly placed for exploring.', capacity: 2, pricePerNight: 205, quantity: 9, amenities: ['Queen bed', 'Workspace'] },
      { name: 'Northline Loft', description: 'A bright loft with a little extra room to settle in.', capacity: 3, pricePerNight: 295, quantity: 3, amenities: ['King bed', 'Sofa bed', 'Workspace'] }
    ]
  },
  {
    name: 'Villa Bellariva',
    location: 'Amalfi Coast',
    country: 'Italy',
    description: 'A restored coastal villa with lemon-garden terraces, handcrafted interiors and easy access to the villages along the shore.',
    image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=85',
    rating: 4.8,
    amenities: ['Sea view', 'Garden', 'Breakfast', 'Pool'],
    featured: true,
    rooms: [
      { name: 'Lemon Garden Double', description: 'A bright room opening onto the villa gardens.', capacity: 2, pricePerNight: 295, quantity: 5, amenities: ['Queen bed', 'Garden view', 'Rain shower'] },
      { name: 'Bellariva Family Suite', description: 'A relaxed suite with a sitting area and coastal balcony.', capacity: 4, pricePerNight: 460, quantity: 2, amenities: ['King bed', 'Sofa bed', 'Sea view'] }
    ]
  },
  {
    name: 'Juniper & Stone',
    location: 'New York',
    country: 'United States',
    description: 'A calm, characterful Manhattan address with neighborhood coffee, considered rooms and the city just outside the door.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85',
    rating: 4.6,
    amenities: ['Restaurant', 'Gym', 'Concierge', 'Free Wi-Fi'],
    featured: false,
    rooms: [
      { name: 'City Queen', description: 'A thoughtfully planned room above the lively streets.', capacity: 2, pricePerNight: 225, quantity: 12, amenities: ['Queen bed', 'Workspace', 'City view'] },
      { name: 'Juniper Studio Suite', description: 'A larger studio with room to relax between city days.', capacity: 3, pricePerNight: 345, quantity: 4, amenities: ['King bed', 'Sofa bed', 'Workspace'] }
    ]
  },
  {
    name: 'Riad Safran',
    location: 'Marrakech',
    country: 'Morocco',
    description: 'A welcoming riad tucked into the medina, centered around a leafy courtyard and a rooftop made for golden-hour tea.',
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1400&q=85',
    rating: 4.9,
    amenities: ['Courtyard pool', 'Rooftop', 'Hammam', 'Breakfast'],
    featured: true,
    rooms: [
      { name: 'Courtyard Double', description: 'A cool, quiet retreat overlooking the central courtyard.', capacity: 2, pricePerNight: 155, quantity: 7, amenities: ['Queen bed', 'Courtyard view', 'Air conditioning'] },
      { name: 'Atlas Family Suite', description: 'A generous suite with a separate sitting room.', capacity: 4, pricePerNight: 245, quantity: 3, amenities: ['King bed', 'Sofa bed', 'Private lounge'] }
    ]
  },
  {
    name: 'Pineglass Lodge',
    location: 'Banff',
    country: 'Canada',
    description: 'A warm mountain lodge close to alpine trails, with fireside evenings, crisp air and wide-open views of the Rockies.',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1400&q=85',
    rating: 4.7,
    amenities: ['Mountain view', 'Hot tub', 'Restaurant', 'Free parking'],
    featured: false,
    rooms: [
      { name: 'Spruce King Room', description: 'A restful room with a view toward the surrounding pines.', capacity: 2, pricePerNight: 210, quantity: 8, amenities: ['King bed', 'Mountain view', 'Soaking tub'] },
      { name: 'Alpine Family Loft', description: 'A spacious loft for a family mountain escape.', capacity: 5, pricePerNight: 365, quantity: 3, amenities: ['King bed', 'Bunk beds', 'Living area'] }
    ]
  }
];

async function seed({ config = loadConfig(), connect = true, log = true } = {}) {
  if (Boolean(config.ADMIN_EMAIL) !== Boolean(config.ADMIN_PASSWORD)) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to create an administrator');
  }
  if (connect) await connectDatabase(config.MONGODB_URI);
  try {
    await Promise.all([RoomNight.init(), User.init()]);
    for (const item of sampleHotels) {
      const { rooms, ...hotelData } = item;
      const hotel = await Hotel.findOneAndUpdate(
        { name: hotelData.name, location: hotelData.location },
        { $set: hotelData },
        { new: true, upsert: true, runValidators: true }
      );
      for (const roomData of rooms) {
        await Room.findOneAndUpdate(
          { hotel: hotel._id, name: roomData.name },
          { $set: roomData },
          { upsert: true, runValidators: true }
        );
      }
    }
    if (config.ADMIN_EMAIL && config.ADMIN_PASSWORD) {
      const email = config.ADMIN_EMAIL.toLowerCase();
      const existing = await User.findOne({ email });
      if (!existing) {
        await User.create({
          name: 'StayEase Admin',
          email,
          passwordHash: await User.hashPassword(config.ADMIN_PASSWORD),
          role: 'admin'
        });
      } else if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
      }
    }
    if (log) console.log(`Seeded ${sampleHotels.length} sample hotels and their rooms.`);
  } finally {
    if (connect && mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error('Unable to seed StayEase:', error);
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error('Unable to close MongoDB connection:', disconnectError);
      }
    }
    process.exitCode = 1;
  });
}

module.exports = { sampleHotels, seed };
