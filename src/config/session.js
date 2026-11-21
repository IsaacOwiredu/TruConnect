const session = require('express-session');
const mongoose = require('mongoose');
const { MongoStore, createWebCryptoAdapter } = require('connect-mongo');
const { isProduction, sessionSecret } = require('./env');

function createSessionMiddleware() {
  const store = mongoose.connection.readyState === 1
    ? MongoStore.create({
      clientPromise: Promise.resolve(mongoose.connection.getClient()),
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60,
      autoRemove: 'native',
      cryptoAdapter: createWebCryptoAdapter({ secret: sessionSecret }),
    })
    : undefined;

  return session({
    name: 'truconnect.sid',
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

module.exports = { createSessionMiddleware };
