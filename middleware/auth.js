const jwt = require('jsonwebtoken');

// Middleware untuk memverifikasi apakah user sudah login (punya token valid)
const verifyToken = (req, res, next) => {
    // Ambil token dari header 'Authorization' (format: Bearer <token>)
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
    }

    try {
        // Verifikasi token menggunakan secret key dari .env
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Simpan data user (id, role, username) ke dalam object req agar bisa dipakai di route
        req.user = verified;
        next(); 
    } catch (err) {
        console.log("Detail Error JWT:", err.message);
        res.status(403).json({ message: 'Token tidak valid atau sudah kadaluwarsa.' });
    }
};

// Middleware untuk membatasi akses berdasarkan Role
// Contoh penggunaan: authorize(['admin']) atau authorize(['admin', 'cashier'])
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Akses ditolak. Role ${req.user.role} tidak diizinkan melakukan aksi ini.` 
            });
        }
        next();
    };
};

module.exports = { verifyToken, authorize };