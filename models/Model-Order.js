const mongoose = require('mongoose');

// Skema untuk detail item di dalam order agar data item saat transaksi terkunci (snapshot)
const OrderItemSchema = new mongoose.Schema({
    idItem: { type: Number, required: true },
    namaItem: { type: String, required: true },
    hargaSaatTransaksi: { type: Number, required: true },
    jumlah: { type: Number, required: true },
    subtotalItem: { type: Number, required: true }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    kodeTransaksi: { 
        type: String, 
        required: true, 
        unique: true // Memastikan tidak ada kode transaksi ganda
    },
    tanggalTransaksi: { 
        type: Date, 
        default: Date.now 
    },
    daftarItem: [OrderItemSchema], // Array berisi item-item yang dibeli
    totalBayar: { 
        type: Number, 
        required: true 
    },
    metodePembayaran: { 
        type: String, 
        enum: ['Cash', 'QRIS'], // Membatasi pilihan metode
        required: true 
    },
    idKasir: { 
        type: String, 
        required: true 
    }
}, { collection: 'Orders' });

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;