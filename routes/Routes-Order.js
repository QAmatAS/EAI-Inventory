const express = require('express');
const router  = express.Router();
const { Kafka } = require('kafkajs');

const Menu      = require('./../models/Model-Menu');
const Inventory = require('./../models/Model-Inventory');
const Order     = require('./../models/Model-Order');
const { verifyToken, authorize } = require('./../middleware/auth');

// --- KAFKA PRODUCER ---
const kafka = new Kafka({
    clientId: 'marioshop-order-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});
const producer = kafka.producer();

// Connect producer satu kali saat modul diload
let producerReady = false;
(async () => {
    try {
        await producer.connect();
        producerReady = true;
        console.log('[Order] Kafka producer terhubung.');
    } catch (err) {
        console.error('[Order] Gagal menghubungkan Kafka producer:', err.message);
    }
})();

// --- CHECKOUT ROUTE ---
router.post('/checkout', verifyToken, authorize(['admin', 'cashier']), async (req, res) => {
    try {
        const { daftarItem, metodePembayaran } = req.body;

        if (!daftarItem || !Array.isArray(daftarItem) || daftarItem.length === 0) {
            return res.status(400).json({ message: 'daftarItem tidak boleh kosong.' });
        }
        if (!metodePembayaran) {
            return res.status(400).json({ message: 'metodePembayaran wajib diisi.' });
        }

        const kodeTransaksi = `TRX-${Date.now()}`;
        let totalSeluruhnya  = 0;
        const processedItems = [];

        // --- VALIDASI STOK (sebelum order dibuat) ---
        for (const item of daftarItem) {
            const inventory = await Inventory.findOne({ idItem: item.idItem });

            if (!inventory) {
                return res.status(404).json({
                    message: `Item dengan ID ${item.idItem} tidak ditemukan di Inventory.`
                });
            }
            if (Number(inventory.stockTotal) < item.jumlah) {
                return res.status(400).json({
                    message: `Stok "${inventory.namaBarang}" tidak cukup. Tersedia: ${inventory.stockTotal}, diminta: ${item.jumlah}.`
                });
            }

            const menuData = await Menu.findOne({ id: item.idItem });
            if (!menuData) {
                return res.status(404).json({
                    message: `Menu dengan ID ${item.idItem} tidak ditemukan.`
                });
            }

            const subtotal = menuData.hargaItem * item.jumlah;
            totalSeluruhnya += subtotal;

            processedItems.push({
                idItem:             menuData.id,
                namaItem:           menuData.namaItem,
                hargaSaatTransaksi: menuData.hargaItem,
                jumlah:             item.jumlah,
                subtotalItem:       subtotal,
            });
        }

        // --- SIMPAN ORDER ---
        const orderBaru = await Order.create({
            kodeTransaksi,
            daftarItem:       processedItems,
            totalBayar:       totalSeluruhnya,
            metodePembayaran,
            idKasir:          req.user.username,
        });

        // --- PUBLISH KE KAFKA (fire-and-forget, tidak blokir response) ---
        if (producerReady) {
            producer.send({
                topic: process.env.KAFKA_TOPIC || 'transaksi-order',
                messages: [{
                    key:   kodeTransaksi,
                    value: JSON.stringify({ kodeTransaksi, daftarItem }),
                }],
            }).catch(err => {
                // Order sudah tersimpan — log error tapi jangan gagalkan response
                console.error(`[Order] Gagal publish ke Kafka untuk ${kodeTransaksi}:`, err.message);
            });
        } else {
            console.warn(`[Order] Kafka producer belum siap. Pesan ${kodeTransaksi} tidak terkirim.`);
        }

        res.status(201).json({
            message:     'Checkout berhasil. Proses inventory berjalan di background.',
            orderDetail: orderBaru,
        });

    } catch (err) {
        console.error('[Order] Error saat checkout:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});

// Tutup producer saat proses berakhir
process.on('SIGINT',  async () => { await producer.disconnect(); });
process.on('SIGTERM', async () => { await producer.disconnect(); });

module.exports = router;