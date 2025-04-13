// agenda.js
const Agenda = require('agenda');
const dotenv = require('dotenv');
dotenv.config();

const agenda = new Agenda({
  db: {
    address: process.env.PG_URL,
    collection: 'agendaJobs', // Table name (it will be created if not present)
    options: {
      useUnifiedTopology: true
    }
  }
});

module.exports = agenda;
