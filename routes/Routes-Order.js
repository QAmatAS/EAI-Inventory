const express = require('express');
const router = express.Router();
const Menu = require('./../models/Model-Menu'); // Import Model Menu
const Order = require('./../models/Model-Order'); // Import Model Order
const { verifyToken, authorize } = require('./../middleware/auth');

router.post('/checkout', verifyToken, authorize(['admin', 'cashier']), async (req, res) => {
    try {
        const { daftarItem, metodePembayaran } = req.body;
        const kodeTransaksi = `TRX-${Date.now()}`;
        let totalSeluruhnya = 0;
        const processedItems = [];

        for (const item of daftarItem) {
            const inventory = await Inventory.findOne({ idItem: item.idItem });
            if (!inventory || inventory.stockTotal < item.jumlah) {
                return res.status(400).json({ message: `Stok ${inventory?.namaBarang || item.idItem} tidak cukup.` });
            }

            // --- LOGIKA FIFO DIMULAI ---
            let jumlahDibutuhkan = item.jumlah;
            let totalHPPUntukItemIni = 0;

            // Filter mutasi "Masuk" yang masih punya sisa stok (asumsi kita simpan sisa di tiap record mutasi)
            // Atau kita hitung dari mutasi masuk yang belum ter-offset sepenuhnya.
            // Cara termudah: Ambil semua mutasi 'Masuk', urutkan berdasarkan tanggal
            let mutasiMasuk = inventory.mutasi.filter(m => 
                m.jenisMutasi.toLowerCase().includes('masuk') && (m.jumlahSisa > 0)
            ).sort((a, b) => a.tanggal - b.tanggal);

            for (let m of mutasiMasuk) {
                if (jumlahDibutuhkan <= 0) break;

                let diambil = Math.min(m.jumlahSisa, jumlahDibutuhkan);
                totalHPPUntukItemIni += (diambil * m.HPPItem);
                m.jumlahSisa -= diambil; // Kurangi jatah di mutasi tersebut
                jumlahDibutuhkan -= diambil;
            }

            // Update data Inventory (Stok Total dan array Mutasi yang sudah terpotong jumlahSisa-nya)
            await inventory.save(); 

            // Tambahkan record mutasi "Keluar" untuk tracking
            const rataRataHPP = totalHPPUntukItemIni / item.jumlah;
            
            await Inventory.findOneAndUpdate(
                { idItem: item.idItem },
                { 
                    $inc: { stockTotal: -item.jumlah },
                    $push: { 
                        mutasi: {
                            tanggal: new Date(),
                            jenisMutasi: `Penjualan FIFO (${kodeTransaksi})`,
                            jumlahItem: item.jumlah,
                            HPPItem: rataRataHPP, // HPP rata-rata dari batch yang terambil
                            stockAfterUpdate: inventory.stockTotal - item.jumlah
                        } 
                    }
                }
            );
            // --- LOGIKA FIFO SELESAI ---

            // Ambil harga jual dari Menu untuk record Order
            const menuData = await Menu.findOne({ id: item.idItem });
            const subtotal = menuData.hargaItem * item.jumlah;
            totalSeluruhnya += subtotal;

            processedItems.push({
                idItem: menuData.id,
                namaItem: menuData.namaItem,
                hargaSaatTransaksi: menuData.hargaItem,
                jumlah: item.jumlah,
                subtotalItem: subtotal,
                totalHPP: totalHPPUntukItemIni // Berguna untuk laporan laba rugi
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