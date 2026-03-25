const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { bootstrapRuntimeData } = require('./db/bootstrap');
const { initializeDatabase } = require('./db/database');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const charityRoutes = require('./routes/charityRoutes');
const drawRoutes = require('./routes/drawRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

let readyPromise;

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await initializeDatabase();
      await bootstrapRuntimeData();
    })();
  }

  return readyPromise;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', async (req, res, next) => {
  try {
    await ensureReady();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/draws', drawRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public/signup.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  ensureReady()
    .then(() => {
      app.listen(PORT, HOST, () => {
        console.log(`GreenGive server running at http://${HOST}:${PORT}`);
        console.log(`API health: http://${HOST}:${PORT}/api/health`);
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = app;
