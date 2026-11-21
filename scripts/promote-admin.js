const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { User } = require('../src/models');

async function promoteAdmin() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: npm run promote-admin -- user@example.com');
  }

  await connectDatabase();
  const user = await User.findOne({ email, accountStatus: 'active' }).exec();
  if (!user) {
    throw new Error('No active account was found for that email. Register the account first.');
  }

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
