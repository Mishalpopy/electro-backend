const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const excelUpload = require('../middleware/excelUploadMiddleware');

router.get('/', productController.getProducts);
router.get('/popular-searches', productController.getPopularSearches);
router.post('/', protect, admin, productController.createProduct);
router.post('/bulk', protect, admin, excelUpload.single('file'), productController.bulkUploadProducts);
router.put('/:id', protect, admin, productController.updateProduct);
router.delete('/:id', protect, admin, productController.deleteProduct);

module.exports = router;
