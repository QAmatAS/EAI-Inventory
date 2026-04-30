const express = require('express');
const router = express.Router();

const Product = require('./../models/Model-Product');
const Inventory = require('./../models/Model-Inventory');
const { verifyToken, authorize } = require('../middleware/auth');


// ========================
// PRODUCT ROUTES
// ========================

// GET semua product
router.get('/products', verifyToken, authorize(['admin', 'cashier']), async (req, res) => {
    try {
        const products = await Product.find({});
        console.log(`User ${req.user.username} sedang melihat semua produk.`);
        res.status(200).json(products);
    } catch (err) {
        console.error('Error saat mengambil data produk:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST tambah product baru
router.post('/products', verifyToken, authorize(['admin']), async (req, res) => {
    try {
        const {
            id,
            gambarProduct,
            namaProduct,
            hargaProduct,
            stokProduct,
            status
        } = req.body;

        // Validasi: Cek apakah ID sudah digunakan
        const existingProduct = await Product.findOne({ id });
        if (existingProduct) {
            return res.status(409).json({ message: `Gagal! Produk dengan ID ${id} sudah ada.` });
        }

        // Buat Product baru
        const newProduct = await Product.create({
            id,
            gambarProduct,
            namaProduct,
            hargaProduct,
            stokProduct: stokProduct || 0,
            status: status ?? true
        });

        // Integrasi Inventory
        const newInventoryItem = await Inventory.create({
            idProduct: id,
            namaProduct: namaProduct,
            gambarProduct: gambarProduct,
            hargaProduct: hargaProduct,
            stockTotal: stokProduct || 0,
            mutasi: [{
                tanggal: new Date(),
                jenisMutasi: "Stok Awal (Produk Baru)",
                jumlahItem: stokProduct || 0,
                jumlahSisa: stokProduct || 0,
                HPPItem: 0,
                stockAfterUpdate: stokProduct || 0
            }]
        });

        console.log(`[AUDIT] Admin ${req.user.username} menambahkan produk & inventory: ${namaProduct}`);

        res.status(201).json({
            message: 'Produk dan Inventory berhasil ditambahkan',
            product: newProduct,
            inventoryItem: newInventoryItem
        });
    } catch (err) {
        console.error('Error saat menambah produk:', err.message);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});

// PATCH update product
router.patch('/products/:id', verifyToken, authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID harus berupa angka.' });
    }

    if (updates.hasOwnProperty('hargaProduct')) {
        if (typeof updates.hargaProduct !== 'number' || updates.hargaProduct < 0) {
            return res.status(400).json({ message: 'Harga harus berupa angka positif.' });
        }
    }

    if (updates.hasOwnProperty('status') && typeof updates.status !== 'boolean') {
        return res.status(400).json({ message: 'Status harus bernilai true atau false.' });
    }

    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { id: parseInt(id) },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: `Produk dengan ID ${id} tidak ditemukan.` });
        }

        console.log(`Produk ID ${id} berhasil diubah.`);
        res.status(200).json({
            message: 'Data produk berhasil diperbarui',
            data: updatedProduct
        });
    } catch (err) {
        console.error('Error saat update produk:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// DELETE product
router.delete('/products/:id', verifyToken, authorize(['admin']), async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID tidak valid. Harus berupa angka.' });
    }

    try {
        const deletedProduct = await Product.findOneAndDelete({ id: parseInt(id) });

        if (!deletedProduct) {
            return res.status(404).json({ 
                message: `Gagal menghapus. Produk dengan ID ${id} tidak ditemukan.` 
            });
        }

        console.log(`Produk "${deletedProduct.namaProduct}" (ID: ${id}) telah dihapus.`);

        res.status(200).json({
            message: 'Produk berhasil dihapus',
            dataDeleted: deletedProduct
        });
    } catch (err) {
        console.error('Error saat menghapus produk:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


module.exports = router;