require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const Twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Initialize tables
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone TEXT UNIQUE,
      state TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      name TEXT,
      frequency TEXT,
      last_contact TIMESTAMP
    );
  `);
}

initDb();

// Helper to send TwiML
function sendMessage(res, message) {
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${message}</Message></Response>`);
}

// SMS webhook
app.post('/sms', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body.trim();

  let user = await pool.query('SELECT * FROM users WHERE phone=$1', [from]);
  if (!user.rows.length) {
    if (body.toUpperCase() === 'JOIN') {
      await pool.query('INSERT INTO users(phone,state) VALUES($1,$2)', [from, 'AWAITING_FRIENDS']);
      return sendMessage(res, 'Welcome! Please give me a list of 5 friends you want to add to your rotation.');
    } else {
      return sendMessage(res, 'Please text JOIN to start.');
    }
  }

  user = user.rows[0];

  if (user.state === 'AWAITING_FRIENDS') {
    const friends = body.split(',').map(f => f.trim()).slice(0, 5);
    for (const name of friends) {
      await pool.query('INSERT INTO friends(user_id,name) VALUES($1,$2)', [user.id, name]);
    }
    await pool.query('UPDATE users SET state=$1 WHERE id=$2', ['AWAITING_FREQUENCY', user.id]);
    return sendMessage(res, `Thanks! Now, for each friend, tell me how often you want to reach out (daily, weekly, monthly).`);
  }

  if (user.state === 'AWAITING_FREQUENCY') {
    const friends = await pool.query('SELECT * FROM friends WHERE user_id=$1', [user.id]);
    const freqs = body.split(',').map(f => f.trim());
    for (let i = 0; i < friends.rows.length; i++) {
      const freq = freqs[i] || 'weekly';
      await pool.query('UPDATE friends SET frequency=$1 WHERE id=$2', [freq, friends.rows[i].id]);
    }
    await pool.query('UPDATE users SET state=$1 WHERE id=$2', ['ACTIVE', user.id]);
    return sendMessage(res, `Setup complete! We'll remind you when to reach out to friends.`);
  }

  if (body.toUpperCase() === 'DONE') {
    await pool.query('UPDATE friends SET last_contact=NOW() WHERE user_id=$1 ORDER BY last_contact NULLS FIRST LIMIT 1', [user.id]);
    return sendMessage(res, 'Great! Marked as contacted.');
  }

  sendMessage(res, 'Unrecognized input. Reply DONE when you reach out to a friend.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
