const { Kafka } = require('kafkajs');
const mongoose = require('mongoose');
require('dotenv').config();

// PENTING: Import semua model agar skema terdaftar di Mongoose
// Menu dibutuhkan oleh middleware di Model-Inventory (post save/findOneAndUpdate)
const Menu      = require('./models/Model-Menu');
const Inventory = require('./models/Model-Inventory');

// --- KONFIGURASI KAFKA ---
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC   = process.env.KAFKA_TOPIC   || 'transaksi-order';
const KAFKA_GROUP   = process.env.KAFKA_GROUP   || 'marioshop-worker';

const kafka = new Kafka({
    clientId: 'marioshop-worker',
    brokers: KAFKA_BROKERS,
    retry: {
        initialRetryTime: 300,
        retries: 8,
    },
});

const consumer = kafka.consumer({ groupId: KAFKA_GROUP });

// --- PROSES FIFO PER TRANSAKSI ---
async function processTransaksi(transaksi) {
    const { kodeTransaksi, daftarItem } = transaksi;
    console.log(`[Worker] Memproses FIFO Transaksi: ${kodeTransaksi}`);

    for (const item of daftarItem) {
        const inventory = await Inventory.findOne({ idItem: item.idItem });

        if (!inventory) {
            console.warn(`[Worker] Item ID ${item.idItem} tidak ditemukan di Inventory.`);
            continue;
        }

        // Logika FIFO: ambil dari mutasi masuk terlama yang masih ada sisa
        let jumlahDibutuhkan = item.jumlah;
        let totalHPPUntukItemIni = 0;

        const mutasiMasuk = inventory.mutasi
            .filter(m => m.jenisMutasi.toLowerCase().includes('masuk') && m.jumlahSisa > 0)
            .sort((a, b) => a.tanggal - b.tanggal);

        for (const m of mutasiMasuk) {
            if (jumlahDibutuhkan <= 0) break;
            const diambil = Math.min(m.jumlahSisa, jumlahDibutuhkan);
            totalHPPUntukItemIni += diambil * m.HPPItem;
            m.jumlahSisa -= diambil;
            jumlahDibutuhkan -= diambil;
        }

        const stokBaru = Number(inventory.stockTotal) - item.jumlah;
        inventory.stockTotal = stokBaru;

        inventory.mutasi.push({
            tanggal: new Date(),
            jenisMutasi: `Penjualan FIFO (${kodeTransaksi})`,
            jumlahItem: item.jumlah,
            jumlahSisa: 0,
            HPPItem: item.jumlah > 0 ? totalHPPUntukItemIni / item.jumlah : 0,
            stockAfterUpdate: stokBaru,
        });

        // inventory.save() memicu middleware post('save') yang sync ke Menu
        await inventory.save();
        console.log(`[Worker] Stok "${inventory.namaBarang}" diperbarui → ${stokBaru}`);
    }
}

// --- START CONSUMER ---
async function startWorker() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Worker] Terhubung ke MongoDB.');

    await consumer.connect();
    console.log('[Worker] Terhubung ke Kafka.');

    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });
    console.log(`[Worker] Subscribe ke topic "${KAFKA_TOPIC}", group "${KAFKA_GROUP}".`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            let transaksi;
            try {
                transaksi = JSON.parse(message.value.toString());
            } catch (parseErr) {
                console.error('[Worker] Gagal parse pesan Kafka:', parseErr.message);
                return; // skip pesan rusak, jangan crash consumer
            }

            try {
                await processTransaksi(transaksi);
            } catch (err) {
                console.error(`[Worker] Error memproses ${transaksi?.kodeTransaksi}:`, err.message);
                // Untuk produksi: kirim ke Dead Letter Topic (DLT) di sini
            }
        },
    });
}

// --- GRACEFUL SHUTDOWN ---
const shutdown = async (signal) => {
    console.log(`\n[Worker] Menerima ${signal}, menutup koneksi...`);
    try {
        await consumer.disconnect();
        await mongoose.disconnect();
        console.log('[Worker] Koneksi ditutup dengan bersih.');
    } catch (err) {
        console.error('[Worker] Error saat shutdown:', err.message);
    }
    process.exit(0);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startWorker().catch(err => {
    console.error('[Worker Fatal Error]:', err);
    process.exit(1);
});