const express = require('express');
const router = express.Router();

// Models
const Menu = require('./../models/Model-Menu');
const Inventory = require('./../models/Model-Inventory');

// Import middleware di bagian atas file router jika belum
const { verifyToken, authorize } = require('../middleware/auth');


// MENU 

router.get('/menu', verifyToken, authorize(['admin', 'cashier']), async (req, res) => {
    try {
        // Mengambil semua data dari koleksi Menu
        const menuItems = await Menu.find({});

        // Log untuk memantau siapa yang mengakses (opsional)
        console.log(`User ${req.user.username} sedang melihat semua menu.`);

        res.status(200).json(menuItems);
    }
    catch (err) {
        console.error('Error saat mengambil data menu:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/menu', verifyToken, authorize(['admin']), async (req, res) => {
    try {
        const {
            id,
            gambarItem,
            namaItem,
            hargaItem,
            jumlahItem,
            status
        } = req.body;

        // 1. Validasi: Cek apakah ID sudah digunakan di Menu
        const existingItem = await Menu.findOne({ id });
        if (existingItem) {
            return res.status(409).json({ message: `Gagal! Item dengan ID ${id} sudah ada.` });
        }

        // 2. Buat Item Menu Baru
        const newMenuItem = await Menu.create({
            id,
            gambarItem,
            namaItem,
            hargaItem,
            jumlahItem: jumlahItem || 0,
            status: status ?? true
        });

        // 3. INTEGRASI INVENTORY (Sekarang dengan hargaItem)
        const newInventoryItem = await Inventory.create({
            idItem: id,
            namaBarang: namaItem,
            gambarItem: gambarItem,
            hargaItem: hargaItem, // Menyimpan harga jual ke dalam inventory
            stockTotal: (jumlahItem || 0).toString(),
            mutasi: [{
                tanggal: new Date(),
                jenisMutasi: "Stok Awal (Input Menu Baru)",
                jumlahItem: jumlahItem || 0,
                jumlahSisa: jumlahItem || 0,
                HPPItem: 0,
                stockAfterUpdate: jumlahItem || 0
            }]
        });

        console.log(`[AUDIT] Admin ${req.user.username} menambahkan menu & inventory: ${namaItem}`);

        res.status(201).json({
            message: 'Item Menu dan Inventory berhasil ditambahkan',
            menuItem: newMenuItem,
            inventoryItem: newInventoryItem
        });
    }
    catch (err) {
        console.error('Error saat menambah menu:', err.message);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});

router.patch('/menu/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // 1. Validasi ID
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID harus berupa angka.' });
    }

    // 2. Validasi Harga (Jika ada di body)
    if (updates.hasOwnProperty('hargaItem')) {
        if (typeof updates.hargaItem !== 'number' || updates.hargaItem < 0) {
            return res.status(400).json({ message: 'Harga harus berupa angka positif.' });
        }
    }

    // 3. Validasi Status (Jika ada di body)
    if (updates.hasOwnProperty('status') && typeof updates.status !== 'boolean') {
        return res.status(400).json({ message: 'Status harus bernilai true atau false.' });
    }

    try {
        const updatedMenu = await Menu.findOneAndUpdate(
            { id: parseInt(id) },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedMenu) {
            return res.status(404).json({ message: `Item dengan ID ${id} tidak ditemukan.` });
        }

        console.log('data berhasil diubah')
        res.status(200).json({
            message: 'Data menu berhasil diperbarui',
            data: updatedMenu
        });

    } catch (err) {
        console.error('Error saat update menu:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.delete('/menu/:id', async (req, res) => {
    const { id } = req.params;

    // 1. Validasi ID (harus angka)
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID tidak valid. Harus berupa angka.' });
    }

    try {
        // 2. Cari dan Hapus
        const deletedItem = await Menu.findOneAndDelete({ id: parseInt(id) });

        // 3. Cek apakah barangnya memang ada sebelumnya
        if (!deletedItem) {
            return res.status(404).json({ 
                message: `Gagal menghapus. Item dengan ID ${id} tidak ditemukan.` 
            });
        }

        console.log(`Item "${deletedItem.namaItem}" (ID: ${id}) telah dihapus.`);

        // 4. Berikan respon sukses
        res.status(200).json({
            message: 'Item berhasil dihapus',
            dataDeleted: deletedItem // Mengirimkan data yang baru saja dihapus sebagai konfirmasi
        });

    } catch (err) {
        console.error('Error saat menghapus menu:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


module.exports = router;