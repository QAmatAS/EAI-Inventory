const mongoose = require('mongoose');

const MutasiSchema = new mongoose.Schema({
    tanggal: { type: Date, default: Date.now },
    jenisMutasi: String, 
    jumlahProduct: Number,
    jumlahSisa: Number,  
    HPPItem: Number,
    stockAfterUpdate: Number,
}, { _id: false });

const InventItemSchema = new mongoose.Schema({
    idProduct: { type: Number, required: true, unique: true },
    namaProduct: { type: String, required: true },
    gambarProduct: String, 
    hargaProduct: Number,   
    mutasi: [MutasiSchema], 
    stockTotal: { type: Number, default: 0 },
}, { collection: 'Inventory' });


InventItemSchema.post('save', async function(doc) {
    try {
        await mongoose.model('Product').findOneAndUpdate(
            { id: doc.idProduct },
            {
                stokProduct: doc.stockTotal,
                status: doc.stockTotal > 0
            }
        );
        console.log(`[Sync-Product] Berhasil update stok ID ${doc.idProduct} melalui 'save'`);
    } catch (err) {
        console.error(`[Sync-Error] Gagal update Product pada 'save': ${err.message}`);
    }
});

InventItemSchema.post('findOneAndUpdate', async function() {
    try {
        const updatedDoc = await this.model.findOne(this.getQuery());
        if (updatedDoc) {
            await mongoose.model('Product').findOneAndUpdate(
                { id: updatedDoc.idProduct },
                { 
                    stokProduct: updatedDoc.stockTotal,
                    status: updatedDoc.stockTotal > 0 
                }
            );
            console.log(`[Sync-Product] Berhasil update stok ID ${updatedDoc.idProduct} melalui 'findOneAndUpdate'`);
        }
    } catch (err) {
        console.error(`[Sync-Error] Gagal update Product pada 'findOneAndUpdate': ${err.message}`);
    }
});

const Inventory = mongoose.model('Inventory', InventItemSchema);
module.exports = Inventory;