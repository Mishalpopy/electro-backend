const productService = require('../services/productService');
const Product = require('../models/ProductModel');
const Brand = require('../models/BrandModel');
const xlsx = require('xlsx');

// pdf-parse v1.x exports a simple async function: pdfParse(buffer) -> { text, ... }
const pdfParse = require('pdf-parse');
console.log('[pdf-parse] loaded, type:', typeof pdfParse);

// ─────────────────────────────────────────────────────────────────────────────
// BATTERY ICON — default image when none is found in the uploaded document
// ─────────────────────────────────────────────────────────────────────────────
const BATTERY_ICON = 'https://cdn-icons-png.flaticon.com/512/2933/2933245.png';

// ─────────────────────────────────────────────────────────────────────────────
// FIELD MAP — all known aliases for each product field (case-insensitive)
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_MAP = {
    brand:        ['brand', 'battery brand', 'battery name (brand)', 'manufacturer', 'make'],
    name:         ['name', 'product name', 'battery name (brand)', 'model', 'battery model', 'item name', 'title'],
    description:  ['description', 'desc', 'details', 'product description', 'about', 'info'],
    price:        ['price', 'price (aed)', 'mrp', 'cost', 'rate', 'selling price', 'unit price'],
    warranty:     ['warranty', 'guarantee', 'warranty (months)', 'warranty period', 'warrantee'],
    capacity:     ['capacity', 'battery capacity', 'capacity (ah)', 'rated capacity'],
    voltage:      ['voltage', 'voltage (v)', 'nominal voltage', 'volt', 'v'],
    battery_type: ['battery type', 'type', 'chemistry', 'cell type', 'technology', 'battery chemistry'],
    ah:           ['ah', 'ah (c20)', 'gh (c20)', 'ampere hour', 'ampere-hour', 'c20', 'capacity (c20)', 'ah rating'],
    cca:          ['cca', 'cca (-18° c)', 'cca (-18c)', 'cca (-18 c)', 'cold cranking amps', 'cold cranking ampere'],
    dimensions:   ['dimensions', 'dimensions (l x b x th mm)', 'dimensions (l x b x h mm)', 'size', 'l x w x h', 'overall dimensions', 'box size'],
    part_number:  ['part number', 'part number / designation', 'pn', 'part no', 'model no', 'part no.', 'item code', 'sku'],
    stock_status: ['stock', 'stock status', 'availability', 'in stock', 'status'],
    type:         ['product type', 'item type', 'category'],
    image:        ['image', 'image url', 'photo', 'thumbnail', 'main image', 'picture', 'img'],
    images:       ['images', 'gallery', 'gallery images', 'additional images', 'image urls'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const normalise = (str) => String(str).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

const matchField = (header) => {
    const h = normalise(header);
    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        for (const alias of aliases) {
            if (normalise(alias) === h || h.includes(normalise(alias)) || normalise(alias).includes(h)) {
                return field;
            }
        }
    }
    return null;
};

const mapRowToProduct = (row) => {
    const normalised = {};
    for (const [key, val] of Object.entries(row)) {
        const field = matchField(key);
        if (field && val !== undefined && val !== null && val !== '') {
            normalised[field] = val;
        }
    }

    const get = (field) => {
        const v = normalised[field];
        return (v !== undefined && v !== null && String(v).trim() !== '') ? String(v).trim() : '-';
    };

    const rawImage = normalised['image'];
    const image = (rawImage && String(rawImage).trim() !== '' && String(rawImage).trim() !== '-')
        ? String(rawImage).trim()
        : BATTERY_ICON;

    const rawImages = normalised['images'];
    const images = (rawImages && String(rawImages).trim() !== '' && String(rawImages).trim() !== '-')
        ? String(rawImages).split(',').map(i => i.trim()).filter(Boolean)
        : [];

    const rawStock = get('stock_status');
    const stock_status = (rawStock === 'Out of Stock') ? 'Out of Stock' : 'In Stock';

    const rawPrice = normalised['price'];
    const price = rawPrice ? Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0 : 0;

    return {
        brand:        get('brand'),
        name:         get('name'),
        description:  get('description'),
        price,
        warranty:     get('warranty'),
        capacity:     get('capacity'),
        voltage:      get('voltage'),
        battery_type: get('battery_type'),
        ah:           get('ah'),
        cca:          get('cca'),
        dimensions:   get('dimensions'),
        part_number:  get('part_number'),
        stock_status,
        type:         normalised['type'] ? String(normalised['type']).trim() : 'battery',
        is_favorite:  false,
        image,
        images,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF Extractor — tuned for Energizer Product Sheet format
// ─────────────────────────────────────────────────────────────────────────────
const extractFromPDF = async (buffer) => {
    console.log('[PDF] Starting extraction, buffer size:', buffer.length);
    const data = await pdfParse(buffer);
    const fullText = data.text;
    console.log('[PDF] Full extracted text:\n', fullText);

    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    console.log('[PDF] Total lines:', lines.length);

    const product = {};

    // ── Strategy 1: Table mode (header row with 2+ field aliases) ────────────
    const ALIAS_WORDS = Object.values(FIELD_MAP).flat().map(normalise);
    let headerLineIdx = -1;
    let headerFields = [];

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const parts = lines[i].split(/\t| {3,}|\|/).map(p => p.trim()).filter(Boolean);
        const matches = parts.filter(p => ALIAS_WORDS.some(a => normalise(p) === a || normalise(p).includes(a)));
        if (matches.length >= 2) {
            headerLineIdx = i;
            headerFields = parts.map(p => matchField(p) || p);
            console.log('[PDF] Table header at line', i, ':', headerFields);
            break;
        }
    }

    if (headerLineIdx >= 0 && headerFields.length >= 2) {
        const products = [];
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
            const cells = lines[i].split(/\t| {3,}|\|/).map(p => p.trim()).filter(Boolean);
            if (cells.length < 2) continue;
            const row = {};
            headerFields.forEach((field, idx) => {
                if (field && cells[idx] !== undefined) row[field] = cells[idx];
            });
            products.push(mapRowToProduct(row));
        }
        console.log('[PDF] Table mode: extracted', products.length, 'products');
        if (products.length > 0) return products;
    }

    // ── Strategy 2: Energizer product sheet fixed value-sequence ─────────────
    // After the "I I I" separator, values appear in this fixed order:
    //  [0]  Short code (EP60JXH)                 → part_number
    //  [1]  HS Code (85071020)                    → skip
    //  [2]  SAP EAN (679741)                      → skip
    //  [3]  Barcode EAN (4016987155196)            → skip
    //  [4]  Equivalent part (MF55D23R)            → description
    //  [5]  Label Short Code (EP60JX)             → name
    //  [6]  Charge Eye (Yes/No)                   → skip
    //  [7]  Voltage (12 V)                        → voltage
    //  [8]  Capacity (60 Ah)                      → ah + capacity
    //  [9]  Reserve Capacity (90 Min)             → skip
    //  [10] CCA (440 A)                           → cca
    //  [11] Acid gravity (1,28)                   → skip
    const separatorIdx = lines.findIndex(l => /^I\s+I\s+I/.test(l));
    console.log('[PDF] Separator "I I I" at line index:', separatorIdx);

    if (separatorIdx >= 0) {
        const afterSep = lines.slice(separatorIdx + 1);
        const SKIP_STARTS = ['©', 'Product Data', 'Electrical', 'Version', 'Dimensions',
            'General', 'Container', 'Terminal', 'Transportation', 'Layout', 'BASE', 'Short code'];
        const valueLines = afterSep.filter(l =>
            !SKIP_STARTS.some(s => l.startsWith(s)) &&
            l.length < 120   // exclude long copyright/disclaimer lines
        );
        console.log('[PDF] Value lines after separator:', JSON.stringify(valueLines));

        if (valueLines[0])  product.part_number = valueLines[0];   // EP60JXH
        if (valueLines[4])  product.description  = valueLines[4];  // MF55D23R (equivalent)
        if (valueLines[5])  product.name         = valueLines[5];  // EP60JX (label/model)
        // [6] = Charge Eye (Yes/No) — skip
        if (valueLines[7])  product.voltage      = valueLines[7];  // 12 V
        if (valueLines[8])  { product.ah = valueLines[8]; product.capacity = valueLines[8]; } // 60 Ah
        // [9] = Reserve Capacity (Min) — skip
        if (valueLines[10]) product.cca          = valueLines[10]; // 440 A

        console.log('[PDF] Sequence mapping result:', product);
    }

    // ── Strategy 3: Dimension extraction from top section ────────────────────
    // "Max Length (L)232 mm", "Max Width (W)173 mm", "Max Height  (H) 225 mm"
    const lenMatch = fullText.match(/Max Length\s*\([^)]*\)\s*([\d,.]+)\s*mm/i);
    const widMatch = fullText.match(/Max Width\s*\([^)]*\)\s*([\d,.]+)\s*mm/i);
    const hgtMatch = fullText.match(/Max Height\s*[^\d]*([\d,.]+)\s*mm/i);
    if (lenMatch && widMatch && hgtMatch) {
        product.dimensions = `${lenMatch[1]}x${widMatch[1]}x${hgtMatch[1]} mm`;
        console.log('[PDF] Dimensions:', product.dimensions);
    }

    // ── Strategy 4: Technology line → battery_type ───────────────────────────
    // "TechnologyFlooded / SLIType of Terminal..."
    const techMatch = fullText.match(/Technology\s*([\w\/\s]+?)(?:Type of Terminal|Alloy|$)/i);
    if (techMatch) {
        product.battery_type = techMatch[1].trim();
        console.log('[PDF] Battery type:', product.battery_type);
    }

    // ── Strategy 5: Brand name detection ─────────────────────────────────────
    if (!product.brand) {
        const brandMatch = fullText.match(/\b(Energizer|ENERGIZER|Bosch|BOSCH|Exide|EXIDE|Varta|VARTA|Amaron|AMARON|Hella|HELLA|Yuasa|YUASA|Delkor|DELKOR)\b/);
        if (brandMatch) {
            product.brand = brandMatch[1];
            console.log('[PDF] Brand:', product.brand);
        }
    }

    // ── Build full product name: "Energizer EP60JX" ──────────────────────────
    if (product.brand && product.name && !product.name.includes(product.brand)) {
        product.name = `${product.brand} ${product.name}`;
    } else if (product.brand && !product.name && product.part_number) {
        product.name = `${product.brand} ${product.part_number}`;
    }

    // ── Build description from specs if equivalent part is a short code ───────
    const descIsShortCode = product.description && /^[A-Z0-9\-\/]{3,15}$/.test(product.description.trim());
    if (descIsShortCode || !product.description) {
        const equivalent = product.description || '';
        const specParts = [
            product.battery_type,
            product.voltage,
            product.ah,
            product.cca ? `CCA: ${product.cca}` : null,
            product.dimensions ? `Size: ${product.dimensions}` : null,
            equivalent ? `Equivalent: ${equivalent}` : null,
        ].filter(Boolean);
        if (specParts.length > 0) product.description = specParts.join(' | ');
    }

    // ── Fallback regex sweeps ─────────────────────────────────────────────────
    if (!product.voltage)  { const m = fullText.match(/(\d+)\s*V\b/);    if (m) product.voltage  = `${m[1]} V`; }
    if (!product.ah)       { const m = fullText.match(/(\d+)\s*Ah/i);    if (m) product.ah       = `${m[1]} Ah`; }
    if (!product.cca)      { const m = fullText.match(/(\d{3,})\s*A\b/); if (m) product.cca      = `${m[1]} A`; }
    if (!product.capacity) product.capacity = product.ah || '-';

    console.log('[PDF] Final fields found:', Object.keys(product).filter(k => product[k]));
    console.log('[PDF] Final product:', JSON.stringify(product, null, 2));
    return [mapRowToProduct(product)];
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

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
                pages: limit > 0 ? Math.ceil(total / limit) : 1,
            },
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const product = await productService.createProduct(req.body);
        res.status(201).json({ status: true, message: 'Product created successfully', data: product });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

const bulkUploadProducts = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ status: false, message: 'Please upload at least one Excel, CSV, or PDF file.' });
        }

        console.log(`[Bulk Upload] ${files.length} file(s) received`);

        let allFormattedProducts = [];

        for (const file of files) {
            const ext = file.originalname.split('.').pop().toLowerCase();
            const isPDF = ext === 'pdf' || file.mimetype === 'application/pdf';
            console.log(`[Bulk Upload] Processing: ${file.originalname} | isPDF: ${isPDF}`);

            if (isPDF) {
                const products = await extractFromPDF(file.buffer);
                console.log(`[Bulk Upload] ${file.originalname} → ${products.length} product(s)`);
                allFormattedProducts.push(...products);
            } else {
                const workbook = xlsx.read(file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
                console.log(`[Bulk Upload] ${file.originalname} → ${rows.length} row(s)`);
                if (rows.length > 0) allFormattedProducts.push(...rows.map(mapRowToProduct));
            }
        }

        if (allFormattedProducts.length === 0) {
            return res.status(400).json({ status: false, message: 'Could not extract any products from the uploaded files.' });
        }

        // Auto-create brand if it doesn't exist in the list
        const brandNames = [...new Set(allFormattedProducts.map(p => p.brand).filter(b => b && typeof b === 'string' && b.trim() !== '' && b.trim() !== '-'))];
        for (const brandName of brandNames) {
            const trimmedName = brandName.trim();
            const brandExists = await Brand.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
            if (!brandExists) {
                console.log(`[Bulk Upload] Brand "${trimmedName}" not on the list. Auto-creating...`);
                await Brand.create({
                    name: trimmedName,
                    image: BATTERY_ICON,
                    status: 'active'
                });
            }
        }

        console.log(`[Bulk Upload] Total products to save: ${allFormattedProducts.length}`);
        const savedProducts = await productService.bulkCreateProducts(allFormattedProducts);

        const fieldsFound = new Set();
        const allFields = Object.keys(FIELD_MAP).filter(f => f !== 'image' && f !== 'images');
        allFormattedProducts.forEach(p => {
            allFields.forEach(f => { if (p[f] && p[f] !== '-') fieldsFound.add(f); });
        });
        const fieldsMissing = allFields.filter(f => !fieldsFound.has(f));

        res.status(201).json({
            status: true,
            message: `${savedProducts.length} product${savedProducts.length !== 1 ? 's' : ''} uploaded from ${files.length} file${files.length !== 1 ? 's' : ''}`,
            summary: {
                filesProcessed: files.length,
                total: savedProducts.length,
                fieldsFound: [...fieldsFound],
                fieldsMissing,
            },
            data: savedProducts,
        });
    } catch (error) {
        console.error('[Bulk Upload] Error:', error.message);
        res.status(500).json({ status: false, message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await productService.updateProduct(req.params.id, req.body);
        if (!product) return res.status(404).json({ status: false, message: 'Product not found' });
        res.status(200).json({ status: true, message: 'Product updated successfully', data: product });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await productService.deleteProduct(req.params.id);
        if (!product) return res.status(404).json({ status: false, message: 'Product not found' });
        res.status(200).json({ status: true, message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

const getPopularSearches = async (req, res) => {
    try {
        const ManagedPopularSearch = require('../models/PopularSearchModel');
        const managed = await ManagedPopularSearch.find({ isActive: true }).sort({ order: 1 });

        if (managed && managed.length > 0) {
            return res.status(200).json({ status: true, data: managed.map(m => m.term) });
        }

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
