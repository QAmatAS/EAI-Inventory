const mongoose = require('mongoose');

const MenuSchema = new mongoose.Schema({
  id: Number,
  gambarItem: String,
  namaItem: String,
  hargaItem: Number,
  jumlahItem: Number,
  status: {
    type: Boolean,
    default: true
  },
}, { collection: 'Menu' });

const Order = mongoose.model('Menu', MenuSchema);
module.exports = Order;