const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const mongoose   = require('mongoose');
const { spawn }  = require('child_process');
require('dotenv').config();

// --- ROUTING ---
const routeAdmin = require('./routes/Routes-Admin');
const routeOrder = require('./routes/Routes-Order');

// --- SERVER SETUP ---
const app  = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[Server] MongoDB connected.'))
    .catch(err => console.error('[Server] MongoDB error:', err));

// Routes
app.use('/Admin', routeAdmin);
app.use('/Order', routeOrder);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- START SERVER ---
app.listen(port, () => {
    console.log(`[Server] Berjalan di port ${port}`);
});

// --- SPAWN WORKER (Kafka Consumer) ---
const worker = spawn('node', ['worker.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
});

worker.stdout.on('data', data => process.stdout.write(`[Worker] ${data}`));
worker.stderr.on('data', data => process.stderr.write(`[Worker ERR] ${data}`));

worker.on('close', code => {
    console.warn(`[Server] Worker berhenti dengan kode: ${code}`);
});

worker.on('error', err => {
    console.error('[Server] Gagal menjalankan worker:', err.message);
});

// Matikan worker bersama server
process.on('SIGINT',  () => { worker.kill('SIGINT');  process.exit(0); });
process.on('SIGTERM', () => { worker.kill('SIGTERM'); process.exit(0); });