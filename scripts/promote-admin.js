const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { User } = require('../src/models');

async function promoteAdmin() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: npm run promote-admin -- user@example.com');
  }

  await connectDatabase();
  const matches = await User.find({ email, accountStatus: 'active' }).limit(2).exec();
  if (!matches.length) {
    throw new Error('No active account was found for that email. Register the account first.');
  }
  if (matches.length > 1) {
    throw new Error('More than one active account uses that email. No account was changed; resolve the duplicate accounts first.');
  }
  const [user] = matches;

  user.role = 'admin';
  await user.save();
  console.log(`Administrator access granted to ${user.email}.`);
}

promoteAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDatabase();
    } catch {
      process.exitCode = 1;
    }
  });
