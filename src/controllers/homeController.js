const categoryService = require('../services/categoryService');
const productService = require('../services/productService');
const Order = require('../models/OrderModel');
const User = require('../models/userModel');
const Brand = require('../models/BrandModel');
const Banner = require('../models/BannerModel');

const getHomeData = async (req, res) => {
    try {
        const products = await productService.getAllProducts();
        const orders = await Order.find();
        const totalCustomers = await User.countDocuments({ role: 'user' });
        const brands = await Brand.find().sort({ createdAt: -1 });
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });

        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalItems = products.length;
        const paginatedProducts = products.slice(skip, skip + limit);

        // Simple section containing all products (no longer category-based)
        const sections = [
            {
                title: "Popular Batteries",
                type: "battery",
                items: paginatedProducts
            }
        ];

        const totalCarted = products.reduce((sum, p) => sum + (p.in_cart_count || 0), 0);

        res.status(200).json({
            status: true,
            message: "Home data fetched successfully",
            data: {
                brands: brands,
                banners: banners,
                sections: sections,
                total_carted: totalCarted,
                total_customers: totalCustomers,
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                total_revenue: totalRevenue,
                pagination: {
                    total: totalItems,
                    page: page,
                    limit: limit,
                    pages: Math.ceil(totalItems / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = {
    getHomeData,
};
