const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    idProduct: { type: Number, required: true },
    namaProduct: { type: String, required: true },
    hargaSaatTransaksi: { type: Number, required: true },
    jumlah: { type: Number, required: true },
    subtotalItem: { type: Number, required: true }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    kodeTransaksi: { 
        type: String, 
        required: true, 
        unique: true
    },
    tanggalTransaksi: { 
        type: Date, 
        default: Date.now 
    },
    daftarItem: [OrderItemSchema],
    totalBayar: { 
        type: Number, 
        required: true 
    },
    metodePembayaran: { 
        type: String, 
        enum: ['Cash', 'QRIS'],
        required: true 
    },
    idKasir: { 
        type: String, 
        required: true 
    }
}, { collection: 'Orders' });

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;