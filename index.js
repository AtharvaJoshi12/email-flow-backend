const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors'); 
const app = express();
const PORT = 5000;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_jwt_secret_key'; 
// PostgreSQL setup
const pgClient = new Client({
  host: 'dpg-cvtolnngi27c73a8eurg-a',
  port: 5432,
  user: 'emai_flow_db_user',
  password: 'IRuQwgZBVoi6ut9nD9KOV5EcpB8i9mIN',
  database: 'emai_flow_db',
});

pgClient.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'atharvajoshi202@gmail.com',
    pass: 'lwqw azfh dblj ehpm',
  },
});

app.use(cors({
    origin: '*',
    credentials: true
  }));
app.use(bodyParser.json());

// Create table if not exists 
pgClient.query(`
  CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE
  );
`);

pgClient.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `);
  

// Schedule cron job to run every minute
cron.schedule('* * * * *', async () => {
  console.log('⏰ Running cron job to check for due emails...');
  const now = new Date();

  // print last 5 emails
  const res = await pgClient.query('SELECT * FROM emails ORDER BY scheduled_time DESC LIMIT 5');
  console.log('Last 5 emails:', res.rows);

  try {
    const res = await pgClient.query(
      'SELECT * FROM emails WHERE scheduled_time <= $1 AND is_sent = false',
      [now]
    );

    for (const email of res.rows) {
      const mailOptions = {
        from: 'atharvajoshi202@gmail.com',
        to: email.to_email,
        subject: email.subject,
        text: email.body,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${email.to_email}`);

        // Mark as sent
        await pgClient.query('UPDATE emails SET is_sent = true WHERE id = $1', [email.id]);
      } catch (err) {
        console.error(`❌ Failed to send email to ${email.to_email}:`, err);
      }
    }
  } catch (err) {
    console.error('❌ Error in cron job:', err);
  }
});

// Routes
app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.post('/schedule-email', async (req, res) => {
  const { to, subject, body, time } = req.body;

  if (!to || !subject || !body || !time) {
    return res.status(400).json({ error: 'All fields (to, subject, body, time) are required!' });
  }

  try {
    const result = await pgClient.query(
      'INSERT INTO emails (to_email, subject, body, scheduled_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [to, subject, body, new Date(time).toISOString()]
    );

    res.json({ message: '✅ Email scheduled successfully!', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error saving email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
  
    try {
      // Check if user exists
      const userExists = await pgClient.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userExists.rows.length > 0)
        return res.status(400).json({ error: 'User already exists' });
  
      const hashedPassword = await bcrypt.hash(password, 10);
      await pgClient.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [email, hashedPassword]
      );
  
      res.json({ message: '✅ Signup successful!' });
    } catch (err) {
      console.error('❌ Signup error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
  
    try {
      const userRes = await pgClient.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = userRes.rows[0];
  
      if (!user)
        return res.status(400).json({ error: 'Invalid credentials' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(400).json({ error: 'Invalid credentials' });
  
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  
      res.json({ message: '✅ Login successful!', token });
    } catch (err) {
      console.error('❌ Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
