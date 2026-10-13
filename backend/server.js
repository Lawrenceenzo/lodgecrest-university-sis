require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { checkMailer } = require('./utils/mailer');
const { migrate } = require('./utils/migrate');

for (const name of ['JWT_SECRET', 'MONGO_URI']) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy .env.example to .env and set a value.`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log(`MongoDB connected (${mongoose.connection.name})`);
    await migrate();
    await checkMailer();
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    console.error('Check MONGO_URI in .env and that your MongoDB server / Atlas cluster is reachable.');
    process.exit(1);
  });
