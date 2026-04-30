const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: Number,
  gambarProduct: String,
  namaProduct: String,
  hargaProduct: Number,
  stokProduct: Number,
  status: {
    type: Boolean,
    default: true
  },
}, { collection: 'Products' });

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;