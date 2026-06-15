const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/image', protect, admin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: false, message: 'Please upload a file' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.status(200).json({
        status: true,
        message: 'Image uploaded successfully',
        data: {
            url: imageUrl,
            filename: req.file.filename
        }
    });
});

module.exports = router;
