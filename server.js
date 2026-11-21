const createApp = require('./src/app');
const { port } = require('./src/config/env');

const app = createApp();
const server = app.listen(port, () => {
  console.log(`TruConnect is running at http://localhost:${port}`);
});

function stopServer(signal) {
  console.log(`${signal} received. Closing the TruConnect server.`);
  server.close((error) => {
    if (error) {
      console.error('The server could not close cleanly.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => stopServer('SIGINT'));
process.once('SIGTERM', () => stopServer('SIGTERM'));
