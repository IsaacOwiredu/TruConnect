const createApp = require('./src/app');
const { mongoUri, port } = require('./src/config/env');
const { connectDatabase, disconnectDatabase } = require('./src/config/database');

async function startServer() {
  if (mongoUri) {
    await connectDatabase();
  } else {
    console.warn('MONGODB_URI is not configured. Database-backed API routes will report unavailable.');
  }

  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`TruConnect is running at http://localhost:${port}`);
  });

  function stopServer(signal) {
    console.log(`${signal} received. Closing the TruConnect server.`);
    server.close(async (error) => {
      if (error) {
        console.error('The server could not close cleanly.');
        process.exitCode = 1;
      }

      try {
        await disconnectDatabase();
      } catch {
        process.exitCode = 1;
      }
    });
  }

  process.once('SIGINT', () => stopServer('SIGINT'));
  process.once('SIGTERM', () => stopServer('SIGTERM'));
}

startServer().catch((error) => {
  console.error('TruConnect could not connect to MongoDB. Check MONGODB_URI and network access.');
  console.error(error.message);
  process.exitCode = 1;
});
