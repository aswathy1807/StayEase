require('dotenv').config();
const { loadConfig } = require('./config');
const { initializeDatabase } = require('./db');
const { createApp } = require('./app');

async function start() {
  const config = loadConfig();
  await initializeDatabase(config.MONGODB_URI);
  const app = createApp(config);
  app.listen(config.PORT, () => {
    console.log(`StayEase is available at http://localhost:${config.PORT}`);
  });
}

start().catch((error) => {
  if (error.code === 8000 && /bad auth|authentication failed/i.test(error.message || '')) {
    console.error(
      'Unable to authenticate with MongoDB Atlas. Check the database user credentials in MONGODB_URI (Atlas Database Access, not your Atlas website login). URL-encode special characters in the username or password. Keep the connection string private.'
    );
  } else {
    console.error('Unable to start StayEase:', error);
  }
  process.exitCode = 1;
});
