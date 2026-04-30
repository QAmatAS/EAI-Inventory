const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

// Routing List
const routeAdmin = require('./routes/Routes-Admin');
const routeOrder = require('./routes/Routes-Order');

// Server Settings
const app = express();
const port = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {})
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// Routing
app.use('/Admin', routeAdmin);
app.use('/Order', routeOrder);

// Server Host
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Spawn worker
const { spawn } = require('child_process');
const worker = spawn('node', ['worker.js']);

worker.stdout.on('data', (data) => {
    console.log(`[Worker Log]: ${data}`);
});

worker.stderr.on('data', (data) => {
    console.error(`[Worker Error]: ${data}`);
});