const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv',
        'application/pdf',
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv', '.pdf'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel, CSV, or PDF files are allowed!'), false);
    }
};

const excelUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
});

module.exports = excelUpload;
