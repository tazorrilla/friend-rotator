require('dotenv').config();
const { Pool } = require('pg');
const Twilio = require('twilio');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function pickFriend(user_id) {
  const { rows } = await pool.query(
    `SELECT * FROM friends WHERE user_id=$1 ORDER BY last_contact NULLS FIRST LIMIT 1`,
    [user_id]
  );
  return rows[0];
}

async function sendReminders() {
  const { rows: users } = await pool.query('SELECT * FROM users WHERE state=$1', ['ACTIVE']);
  for (const user of users) {
    const friend = await pickFriend(user.id);
    if (!friend) continue;
    await client.messages.create({
      body: `Hey! Consider reaching out to ${friend.name} today.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phone
    });
    console.log(`Reminder sent to ${user.phone} for friend ${friend.name}`);
  }
  process.exit();
}

sendReminders();
