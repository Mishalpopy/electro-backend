const Category = require('../models/CategoryModel');

const getAllCategories = async () => {
    return await Category.find().select('-__v -_id');
};

const getCategoryById = async (id) => {
    return await Category.findOne({ id }).select('-__v -_id');
};

const createCategory = async (categoryData) => {
    const category = new Category(categoryData);
    return await category.save();
};

const updateCategory = async (id, updateData) => {
    return await Category.findOneAndUpdate({ id }, updateData, { returnDocument: 'after', runValidators: true }).select('-__v -_id');
};

const deleteCategory = async (id) => {
    return await Category.findOneAndDelete({ id });
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};
