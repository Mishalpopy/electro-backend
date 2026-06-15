const Product = require('../models/ProductModel');

const getAllProducts = async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return await Product.find()
        .skip(skip)
        .limit(limit)
        .select('-__v -_id');
};

const countProducts = async () => {
    return await Product.countDocuments();
};

const getProductsByType = async (type) => {
    return await Product.find({ type }).select('-__v -_id');
};

const getProductById = async (id) => {
    return await Product.findOne({ id }).select('-__v -_id');
};

const createProduct = async (productData) => {
    const product = new Product(productData);
    return await product.save();
};

const bulkCreateProducts = async (productsData) => {
    // Insert many products. Pre hooks might not run for insertMany,
    // so we need to handle sequential IDs or save them one by one.
    // For safety with pre 'save' hooks, we map and save them concurrently.
    const savedProducts = [];
    for (const productData of productsData) {
        const product = new Product(productData);
        savedProducts.push(await product.save());
    }
    return savedProducts;
};

const updateProduct = async (id, updateData) => {
    return await Product.findOneAndUpdate({ id }, updateData, { returnDocument: 'after', runValidators: true }).select('-__v -_id');
};

const deleteProduct = async (id) => {
    return await Product.findOneAndDelete({ id });
};

module.exports = {
    getAllProducts,
    countProducts,
    getProductsByType,
    getProductById,
    createProduct,
    bulkCreateProducts,
    updateProduct,
    deleteProduct,
};
