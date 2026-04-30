const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
// Memastikan dotenv mencari file .env di direktori root proyek
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// --- 1. VALIDASI ENV (Sangat Penting) ---
const requiredEnvs = [
    'KAFKA_BROKER', 
    'KAFKA_CA_PATH', 
    'KAFKA_SERVICE_KEY_PATH', 
    'KAFKA_SERVICE_CERT_PATH'
];

requiredEnvs.forEach(envName => {
    if (!process.env[envName]) {
        console.error(`[Worker Error]: Variabel ${envName} tidak ditemukan di .env!`);
        process.exit(1);
    }
});

// --- 2. KONFIGURASI KAFKA ---
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'marioshop-worker',
    brokers: [process.env.KAFKA_BROKER],
    // Tambahkan dua baris ini untuk memberikan waktu lebih lama saat koneksi awal
    connectionTimeout: 20000,      // Tingkatkan ke 20 detik
    authenticationTimeout: 20000,  // Tingkatkan ke 20 detik
    ssl: {
        rejectUnauthorized: true,
        ca: [fs.readFileSync(path.resolve(__dirname, process.env.KAFKA_CA_PATH), 'utf-8')],
        key: fs.readFileSync(path.resolve(__dirname, process.env.KAFKA_SERVICE_KEY_PATH), 'utf-8'),
        cert: fs.readFileSync(path.resolve(__dirname, process.env.KAFKA_SERVICE_CERT_PATH), 'utf-8'),
        servername: process.env.KAFKA_BROKER.split(':')[0] 
    },
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'inventory-group' });

async function startSimpleConsumer() {
    try {
        await consumer.connect();
        await consumer.subscribe({ 
            topic: process.env.KAFKA_TOPIC || 'inventory_logs', 
            fromBeginning: false 
        });

        console.log(`[Worker Log]: Berhasil subscribe ke Topic: ${process.env.KAFKA_TOPIC}`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const payload = message.value.toString();
                console.log('--- Pesan Diterima ---');
                console.log(`Payload: ${payload}`);
                console.log('----------------------');
            },
        });
    } catch (error) {
        console.error('[Worker Fatal Error]:', error);
    }
}

startSimpleConsumer();