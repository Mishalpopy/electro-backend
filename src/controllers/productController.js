const productService = require('../services/productService');
const Product = require('../models/ProductModel');
const xlsx = require('xlsx');

const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        let products;
        let total;

        if (limit === 0) {
            products = await Product.find().select('-__v -_id');
            total = products.length;
        } else {
            products = await productService.getAllProducts(page, limit);
            total = await productService.countProducts();
        }

        res.status(200).json({ 
            status: true, 
            data: products,
            pagination: {
                total,
                page,
                limit,
                pages: limit > 0 ? Math.ceil(total / limit) : 1
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const product = await productService.createProduct(req.body);
        res.status(201).json({ status: true, message: "Product created successfully", data: product });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

const bulkUploadProducts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: false, message: "Please upload an Excel file." });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ status: false, message: "The uploaded file is empty." });
        }

        const formattedProducts = rows.map((row) => ({
            brand: row['Battery Name (Brand)'] || row.brand || row.Brand || 'Unknown',
            name: row['Battery Name (Brand)'] || row.name || row.Name || 'Unnamed Product',
            description: row.description || row.Description || 'No description provided',
            price: Number(row['Price (AED)'] || row.price || row.Price || 0),
            image: row.Image || row.image || 'https://placehold.co/400x400?text=No+Image',
            images: (row.Images || row.images) ? String(row.Images || row.images).split(',').map(i => i.trim()) : [],
            warranty: row.Warranty || row.warranty || 'Not specified',
            capacity: row.Capacity || row.capacity || 'Not specified',
            voltage: row.Voltage || row.voltage || 'Not specified',
            battery_type: row['Battery Type'] || row.battery_type || 'Not specified',
            ah: String(row['AH (C20)'] || row['GH (C20)'] || row.ah || 'Not specified'),
            cca: String(row['CCA (-18° C)'] || row['CCA (-18C)'] || row['CCA (-18 C)'] || row.cca || 'Not specified'),
            dimensions: String(row['Dimensions (L x B x TH mm)'] || row['Dimensions (L x B x H mm)'] || row.dimensions || 'Not specified'),
            part_number: String(row['Part Number / Designation'] || row.part_number || 'Not specified'),
            stock_status: row.Stock || row.stock || row.stock_status || row.Stock_status || 'In Stock',
            is_favorite: row.is_favorite || row.Is_favorite || row.isFavorite || false,
            type: row.type || row.Type || 'battery',
        }));

        const savedProducts = await productService.bulkCreateProducts(formattedProducts);
        res.status(201).json({ status: true, message: `${savedProducts.length} products uploaded successfully`, data: savedProducts });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await productService.updateProduct(req.params.id, req.body);
        if (!product) return res.status(404).json({ status: false, message: "Product not found" });
        res.status(200).json({ status: true, message: "Product updated successfully", data: product });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await productService.deleteProduct(req.params.id);
        if (!product) return res.status(404).json({ status: false, message: "Product not found" });
        res.status(200).json({ status: true, message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

const getPopularSearches = async (req, res) => {
    try {
        // First try to get from managed popular searches
        const ManagedPopularSearch = require('../models/PopularSearchModel');
        const managed = await ManagedPopularSearch.find({ isActive: true }).sort({ order: 1 });
        
        if (managed && managed.length > 0) {
            return res.status(200).json({ status: true, data: managed.map(m => m.term) });
        }

        // Fallback to dynamic brands/types
        const brands = await Product.distinct('brand');
        const types = await Product.distinct('battery_type');
        const combined = [...new Set([...brands, ...types])].filter(Boolean).slice(0, 15);
        
        res.status(200).json({ status: true, data: combined });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    getProducts,
    createProduct,
    bulkUploadProducts,
    updateProduct,
    deleteProduct,
    getPopularSearches,
};
