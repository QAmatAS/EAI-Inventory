const amqp = require('amqplib');
const mongoose = require('mongoose');
require('dotenv').config();

// Import kedua model agar skema terdaftar di Mongoose
// Model-Product dibutuhkan oleh middleware di Model-Inventory
const Product = require('./models/Model-Product'); 
const Inventory = require('./models/Model-Inventory');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = "exchange_utama";
const QUEUE_INVENTORY = "inventory_updates";
const ROUTING_KEY_INVENTORY = "routing_inventory";

async function startSubscriber() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Worker connected to MongoDB...');

        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(QUEUE_INVENTORY, { durable: true });
        await channel.bindQueue(QUEUE_INVENTORY, EXCHANGE, ROUTING_KEY_INVENTORY);

        channel.prefetch(1);
        console.log(`[*] Worker aktif. Menunggu pesan di: ${QUEUE_INVENTORY}`);

        channel.consume(QUEUE_INVENTORY, async (msg) => {
            if (msg !== null) {
                let transaksi;
                try {
                    transaksi = JSON.parse(msg.content.toString());
                } catch (e) {
                    console.error('[!] Gagal parse JSON');
                    return channel.nack(msg, false, false);
                }

                const { kodeTransaksi, daftarItem } = transaksi;
                console.log(`[x] Memproses FIFO Transaksi: ${kodeTransaksi}`);

                try {
                    for (const item of daftarItem) {
                        const inventory = await Inventory.findOne({ idProduct: item.idProduct });
                        
                        if (!inventory) {
                            console.warn(`   - [!] Produk ID ${item.idProduct} tidak ditemukan.`);
                            continue;
                        }

                        // Logika FIFO
                        let jumlahDibutuhkan = item.jumlah;
                        let totalHPPUntukItemIni = 0;

                        let mutasiMasuk = inventory.mutasi.filter(m => 
                            m.jenisMutasi.toLowerCase().includes('masuk') && (m.jumlahSisa > 0)
                        ).sort((a, b) => a.tanggal - b.tanggal);

                        for (let m of mutasiMasuk) {
                            if (jumlahDibutuhkan <= 0) break;
                            let diambil = Math.min(m.jumlahSisa, jumlahDibutuhkan);
                            totalHPPUntukItemIni += (diambil * m.HPPItem);
                            m.jumlahSisa -= diambil;
                            jumlahDibutuhkan -= diambil;
                        }

                        let stokBaru = Number(inventory.stockTotal) - item.jumlah;
                        inventory.stockTotal = stokBaru;
                        
                        inventory.mutasi.push({
                            tanggal: new Date(),
                            jenisMutasi: `Penjualan FIFO (${kodeTransaksi})`,
                            jumlahItem: item.jumlah,
                            HPPItem: totalHPPUntukItemIni / item.jumlah || 0,
                            stockAfterUpdate: stokBaru
                        });

                        // inventory.save() memicu middleware post('save') 
                        // yang akan sync ke model Product
                        await inventory.save(); 
                        console.log(`   - Berhasil update stok: ${inventory.namaProduct}`);
                    }
                    channel.ack(msg);
                } catch (err) {
                    console.error('[-] Error DB:', err.message);
                    channel.nack(msg);
                }
            }
        });

    } catch (error) {
        console.error('[-] RabbitMQ Connection Error:', error);
    }
}

startSubscriber();