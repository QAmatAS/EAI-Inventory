const express = require('express');
const router = express.Router();
const Product = require('./../models/Model-Product');
const Inventory = require('./../models/Model-Inventory');
const Order = require('./../models/Model-Order');
const { verifyToken, authorize } = require('./../middleware/auth');

router.post('/checkout', verifyToken, authorize(['admin', 'cashier']), async (req, res) => {
    try {
        const { daftarItem, metodePembayaran } = req.body;
        const kodeTransaksi = `TRX-${Date.now()}`;
        let totalSeluruhnya = 0;
        const processedItems = [];

        for (const item of daftarItem) {
            const inventory = await Inventory.findOne({ idProduct: item.idProduct });
            if (!inventory || inventory.stockTotal < item.jumlah) {
                return res.status(400).json({ 
                    message: `Stok ${inventory?.namaProduct || item.idProduct} tidak cukup.` 
                });
            }

            // --- LOGIKA FIFO ---
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

            await inventory.save();

            const rataRataHPP = totalHPPUntukItemIni / item.jumlah;

            await Inventory.findOneAndUpdate(
                { idProduct: item.idProduct },
                { 
                    $inc: { stockTotal: -item.jumlah },
                    $push: { 
                        mutasi: {
                            tanggal: new Date(),
                            jenisMutasi: `Penjualan FIFO (${kodeTransaksi})`,
                            jumlahItem: item.jumlah,
                            HPPItem: rataRataHPP,
                            stockAfterUpdate: inventory.stockTotal - item.jumlah
                        } 
                    }
                }
            );
            // --- FIFO SELESAI ---

            const productData = await Product.findOne({ id: item.idProduct });
            const subtotal = productData.hargaProduct * item.jumlah;
            totalSeluruhnya += subtotal;

            processedItems.push({
                idProduct: productData.id,
                namaProduct: productData.namaProduct,
                hargaSaatTransaksi: productData.hargaProduct,
                jumlah: item.jumlah,
                subtotalItem: subtotal,
                totalHPP: totalHPPUntukItemIni
            });
        }

        const orderBaru = await Order.create({
            kodeTransaksi,
            daftarItem: processedItems,
            totalBayar: totalSeluruhnya,
            metodePembayaran,
            idKasir: req.user.username 
        });

        res.status(201).json({ message: 'Checkout FIFO Berhasil', orderDetail: orderBaru });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;