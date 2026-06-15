const multer = require('multer');

// Use memory storage for Excel files since we only need to parse them in memory
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Check for excel memetypes
    if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.csv')
    ) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel/CSV files are allowed!'), false);
    }
};

const excelUpload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = excelUpload;
