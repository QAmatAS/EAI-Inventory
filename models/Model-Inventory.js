const mongoose = require('mongoose');

const MutasiSchema = new mongoose.Schema({
    tanggal: { type: Date, default: Date.now },
    jenisMutasi: String, 
    jumlahItem: Number,
    jumlahSisa: Number,  
    HPPItem: Number,
    stockAfterUpdate: Number,
}, { _id: false });

const InventItemSchema = new mongoose.Schema({
    idItem: { type: Number, required: true, unique: true },
    namaBarang: { type: String, required: true },
    gambarItem: String, 
    hargaItem: Number,   
    mutasi: [MutasiSchema], 
    stockTotal: { type: Number, default: 0 }, // Sudah diubah ke Number untuk kalkulasi FIFO
}, { collection: 'Inventory' });


InventItemSchema.post('save', async function(doc) {
    try {
        await mongoose.model('Menu').findOneAndUpdate(
            { id: doc.idItem },
            {
                jumlahItem: doc.stockTotal,
                status: doc.stockTotal > 0
            }
        );
        console.log(`[Sync-Menu] Berhasil update stok ID ${doc.idItem} melalui 'save'`);
    } catch (err) {
        console.error(`[Sync-Error] Gagal update Menu pada 'save': ${err.message}`);
    }
});

InventItemSchema.post('findOneAndUpdate', async function() {
    try {
        // Ambil dokumen yang baru saja diupdate
        const updatedDoc = await this.model.findOne(this.getQuery());
        if (updatedDoc) {
            await mongoose.model('Menu').findOneAndUpdate(
                { id: updatedDoc.idItem },
                { 
                    jumlahItem: updatedDoc.stockTotal,
                    status: updatedDoc.stockTotal > 0 
                }
            );
            console.log(`[Sync-Menu] Berhasil update stok ID ${updatedDoc.idItem} melalui 'findOneAndUpdate'`);
        }
    } catch (err) {
        console.error(`[Sync-Error] Gagal update Menu pada 'findOneAndUpdate': ${err.message}`);
    }
});

// Export Model
const Inventory = mongoose.model('Inventory', InventItemSchema);
module.exports = Inventory;