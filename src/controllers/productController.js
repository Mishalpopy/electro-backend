const productService = require('../services/productService');
const Product = require('../models/ProductModel');
const Brand = require('../models/BrandModel');
const xlsx = require('xlsx');
const { OpenAI } = require('openai');
const { pdfToPng } = require('pdf-to-png-converter');
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

// pdf-parse v1.x exports a simple async function: pdfParse(buffer) -> { text, ... }
const pdfParse = require('pdf-parse');
console.log('[pdf-parse] loaded, type:', typeof pdfParse);

// ─────────────────────────────────────────────────────────────────────────────
// BATTERY ICON — default image when none is found in the uploaded document
// ─────────────────────────────────────────────────────────────────────────────
const BATTERY_ICON = '/icons/eletro-battery-tile-1024.png';

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
const clean = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, '');

const matchField = (header) => {
    const hClean = clean(header);
    if (!hClean) return null;

    // Pass 1: Exact matches (ignoring spaces/special characters)
    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        for (const alias of aliases) {
            if (clean(alias) === hClean) {
                return field;
            }
        }
    }

    // Pass 2: Substring matches (e.g. 'battery capacity' containing 'capacity')
    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        for (const alias of aliases) {
            const aClean = clean(alias);
            if (aClean.includes(hClean) || hClean.includes(aClean)) {
                return field;
            }
        }
    }
    return null;
};

const mapRowToProduct = (row, batteryIconUrl = BATTERY_ICON) => {
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
        : batteryIconUrl;

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
// PDF Extractor with AI (OpenAI Vision) & Jimp Image Cropper
// ─────────────────────────────────────────────────────────────────────────────
const extractFromPDFWithAI = async (pdfBuffer, filename = '', protocol = 'http', host = 'localhost') => {
    console.log(`[AI PDF] Starting AI-based extraction for: ${filename}, buffer size: ${pdfBuffer.length}`);

    // 1. Convert PDF's first page to a PNG buffer
    const pngPages = await pdfToPng(pdfBuffer, {
        viewportScale: 2.0,
        pagesToProcess: [1]
    });

    if (!pngPages || pngPages.length === 0) {
        throw new Error('Failed to render PDF page to PNG image buffer');
    }

    const pagePngBuffer = pngPages[0].content;
    const base64Image = pagePngBuffer.toString('base64');

    // 2. Initialize OpenAI client
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    console.log('[AI PDF] Sending page image to OpenAI Vision API...');

    // 3. Make chat completion call to GPT-4o
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `Analyze this image of a product specification sheet for a battery. 
Please extract the following information and output it strictly as a JSON object:
{
  "brand": "The battery brand (e.g. Energizer, Bosch, Solite)",
  "name": "The full product name (e.g. Energizer EP100L5)",
  "part_number": "The model or part number of the battery (e.g. EP100L5H)",
  "description": "A brief description (e.g. DIN100 - MF60044 or other key details)",
  "capacity": "Capacity value (e.g. 100 Ah)",
  "voltage": "Nominal voltage (e.g. 12 V)",
  "battery_type": "Chemistry or type (e.g. Flooded / SLI, AGM, Gel, etc.)",
  "ah": "Ampere Hour rating as a number or string (e.g. 100)",
  "cca": "Cold Cranking Amps rating (e.g. 850 A)",
  "dimensions": "Overall dimensions (e.g. 353x175x190 mm)",
  "crop_box": {
    "x": "The starting X coordinate of the battery/product picture as a percentage of page width (0 to 100)",
    "y": "The starting Y coordinate of the battery/product picture as a percentage of page height (0 to 100)",
    "width": "The width of the battery/product picture as a percentage of page width (0 to 100)",
    "height": "The height of the battery/product picture as a percentage of page height (0 to 100)"
  }
}

Important details:
- Make sure to locate the actual physical photo of the battery product on the page to provide the crop_box coordinates.
- If no battery photo is found, omit or set the crop_box to null.`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/png;base64,${base64Image}`
                        }
                    }
                ]
            }
        ]
    });

    const resultText = response.choices[0].message.content;
    console.log('[AI PDF] OpenAI Response received:', resultText);

    let parsedResult;
    try {
        parsedResult = JSON.parse(resultText);
    } catch (parseErr) {
        throw new Error(`Failed to parse OpenAI JSON response: ${parseErr.message}`);
    }

    // Default icon if image fails
    let finalImageUrl = `${protocol}://${host}/icons/eletro-battery-tile-1024.png`;

    // 4. Crop the image using Jimp if crop_box coordinates are returned
    if (parsedResult.crop_box && typeof parsedResult.crop_box === 'object') {
        const { x, y, width: boxWidth, height: boxHeight } = parsedResult.crop_box;
        
        // Convert to numbers
        const pctX = parseFloat(x);
        const pctY = parseFloat(y);
        const pctW = parseFloat(boxWidth);
        const pctH = parseFloat(boxHeight);

        if (!isNaN(pctX) && !isNaN(pctY) && !isNaN(pctW) && !isNaN(pctH) && pctW > 1 && pctH > 1) {
            try {
                console.log('[AI PDF] Initializing Jimp to crop battery image...');
                const image = await Jimp.read(pagePngBuffer);
                const imgWidth = image.bitmap.width;
                const imgHeight = image.bitmap.height;

                // Calculate absolute coordinates
                const cropX = Math.round((pctX / 100) * imgWidth);
                const cropY = Math.round((pctY / 100) * imgHeight);
                const cropW = Math.round((pctW / 100) * imgWidth);
                const cropH = Math.round((pctH / 100) * imgHeight);

                // Ensure coordinates are within image boundaries
                const safeX = Math.max(0, Math.min(cropX, imgWidth - 1));
                const safeY = Math.max(0, Math.min(cropY, imgHeight - 1));
                const safeW = Math.max(1, Math.min(cropW, imgWidth - safeX));
                const safeH = Math.max(1, Math.min(cropH, imgHeight - safeY));

                console.log(`[AI PDF] Cropping: x=${safeX}, y=${safeY}, w=${safeW}, h=${safeH} | Original: ${imgWidth}x${imgHeight}`);
                
                image.crop({ x: safeX, y: safeY, w: safeW, h: safeH });

                // Ensure static uploads folder exists
                const uploadDir = path.join(__dirname, '../uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                // Save image
                const uniqueFilename = `battery-ai-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
                const savePath = path.join(uploadDir, uniqueFilename);
                await image.write(savePath);

                finalImageUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;
                console.log(`[AI PDF] Cropped image saved successfully to: ${savePath}`);
            } catch (jimpErr) {
                console.error('[AI PDF] Jimp cropping failed, using default battery icon:', jimpErr.message);
            }
        }
    }

    // 5. Format product object for database insertion
    const product = {
        brand:        parsedResult.brand || '-',
        name:         parsedResult.name || '-',
        description:  parsedResult.description || '-',
        price:        parsedResult.price ? Number(parsedResult.price) : 0,
        warranty:     parsedResult.warranty || '-',
        capacity:     parsedResult.capacity || '-',
        voltage:      parsedResult.voltage || '-',
        battery_type: parsedResult.battery_type || '-',
        ah:           parsedResult.ah ? String(parsedResult.ah) : '-',
        cca:          parsedResult.cca ? String(parsedResult.cca) : '-',
        dimensions:   parsedResult.dimensions || '-',
        part_number:  parsedResult.part_number || '-',
        stock_status: parsedResult.stock_status || 'In Stock',
        type:         parsedResult.type || 'battery',
        is_favorite:  false,
        image:        finalImageUrl,
        images:       []
    };

    return [product];
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF Extractor — tuned for Energizer Product Sheet format
// ─────────────────────────────────────────────────────────────────────────────
const extractFromPDF = async (buffer, filename = '', batteryIconUrl = BATTERY_ICON) => {
    console.log('[PDF] Starting extraction, buffer size:', buffer.length);
    const data = await pdfParse(buffer);
    const fullText = data.text;
    console.log('[PDF] Full extracted text length:', fullText.length);

    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    console.log('[PDF] Total lines:', lines.length);

    // ── Strategy 1b: Two-line layout (Line 1: PartNumber + Brand + AH, Line 2: Price) ──
    const products = [];
    const listWarranty = fullText.match(/(\d+)\s*Month\s*Warranty/i)?.[0] || '12 Month Warranty';
    
    let filenameBrand = '';
    if (filename) {
        const cleanFn = filename.replace(/\.[^/.]+$/, ""); // strip extension
        const fnParts = cleanFn.split(/_| - /);
        for (const part of fnParts) {
            const p = part.trim().replace(/[^a-zA-Z0-9]/g, '');
            if (p && /^(Solite|Energizer|Bosch|Exide|Varta|Amaron|Hella|Yuasa|Delkor|ACDelco|Panasonic|Sebang|Asimco)$/i.test(p)) {
                filenameBrand = part.trim().replace(/[®™]/g, '');
                break;
            }
        }
        if (!filenameBrand) {
            const match = cleanFn.match(/^([a-zA-Z0-9]{3,20})/);
            if (match && !/^(Product|Sheet|Catalogue|Price|List|Updated|Draft|Copy)$/i.test(match[1])) {
                filenameBrand = match[1];
            }
        }
    }

    let textBrand = '';
    const brandSymbolMatch = fullText.match(/\b([A-Za-z0-9\-]{3,20})\s*[®™]/);
    if (brandSymbolMatch) {
        textBrand = brandSymbolMatch[1];
    }

    const brandPatterns = ['Solite', 'Energizer', 'Bosch', 'Exide', 'Varta', 'Amaron', 'Hella', 'Yuasa', 'Delkor', 'ACDelco', 'Sebang', 'Asimco'];
    if (filenameBrand && !brandPatterns.map(b => b.toLowerCase()).includes(filenameBrand.toLowerCase())) {
        brandPatterns.push(filenameBrand);
    }
    if (textBrand && !brandPatterns.map(b => b.toLowerCase()).includes(textBrand.toLowerCase())) {
        brandPatterns.push(textBrand);
    }

    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        const priceMatch = nextLine.match(/^\d+(?:\.\d{2})?\s*$/);
        if (!priceMatch) continue;

        let foundBrand = '';
        for (const bp of brandPatterns) {
            if (line.toLowerCase().includes(bp.toLowerCase())) {
                foundBrand = bp;
                break;
            }
        }

        if (foundBrand) {
            const brandIdx = line.toLowerCase().indexOf(foundBrand.toLowerCase());
            const partNumRaw = line.substring(0, brandIdx).trim();
            const afterBrandRaw = line.substring(brandIdx + foundBrand.length).trim();

            if (partNumRaw.length >= 3) {
                const productPrice = parseFloat(nextLine);
                
                let ah = '-';
                const ahMatch = afterBrandRaw.match(/(\d+)\s*AH/i);
                if (ahMatch) {
                    ah = `${ahMatch[1]} Ah`;
                }

                let cca = '-';
                const ccaMatch = afterBrandRaw.match(/(\d+)\s*CCA/i);
                if (ccaMatch) {
                    cca = `${ccaMatch[1]} A`;
                }

                const mappedProduct = {
                    brand: foundBrand,
                    part_number: partNumRaw,
                    name: `${foundBrand} ${partNumRaw}`,
                    ah: ah,
                    capacity: ah !== '-' ? ah : (afterBrandRaw || '-'),
                    cca: cca,
                    price: productPrice,
                    warranty: listWarranty,
                    voltage: '12 V',
                    battery_type: partNumRaw.startsWith('CMF') ? 'Flooded / CMF' : 'Flooded / SLI',
                    description: `${foundBrand} Battery | Part: ${partNumRaw} | Capacity: ${afterBrandRaw || ah}`,
                    stock_status: 'In Stock',
                    type: 'battery',
                    image: batteryIconUrl,
                    images: []
                };

                products.push(mappedProduct);
            }
        }
    }

    if (products.length > 0) {
        console.log(`[PDF] Two-line layout matched! Extracted ${products.length} products.`);
        return products;
    }

    // ── Fallback to original Energizer / generic strategies ──
    const product = {};

    // ── Strategy 1: Table mode (header row with 2+ field aliases) ────────────
    const ALIAS_WORDS = Object.values(FIELD_MAP).flat().map(clean);
    let headerLineIdx = -1;
    let headerFields = [];

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const parts = lines[i].split(/\t| {3,}|\|/).map(p => p.trim()).filter(Boolean);
        const matches = parts.filter(p => ALIAS_WORDS.some(a => clean(p) === a || clean(p).includes(a) || a.includes(clean(p))));
        if (matches.length >= 2) {
            headerLineIdx = i;
            headerFields = parts.map(p => matchField(p) || p);
            console.log('[PDF] Table header at line', i, ':', headerFields);
            break;
        }
    }

    if (headerLineIdx >= 0 && headerFields.length >= 2) {
        const tableProducts = [];
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
            const cells = lines[i].split(/\t| {3,}|\|/).map(p => p.trim()).filter(Boolean);
            if (cells.length < 2) continue;
            const row = {};
            headerFields.forEach((field, idx) => {
                if (field && cells[idx] !== undefined) row[field] = cells[idx];
            });
            tableProducts.push(mapRowToProduct(row));
        }
        console.log('[PDF] Table mode: extracted', tableProducts.length, 'products');
        if (tableProducts.length > 0) return tableProducts;
    }

    // ── Strategy 2: Energizer product sheet fixed value-sequence ─────────────
    const separatorIdx = lines.findIndex(l => /^I\s+I\s+I/.test(l));
    console.log('[PDF] Separator "I I I" at line index:', separatorIdx);

    if (separatorIdx >= 0) {
        const afterSep = lines.slice(separatorIdx + 1);
        const SKIP_STARTS = ['©', 'Product Data', 'Electrical', 'Version', 'Dimensions',
            'General', 'Container', 'Terminal', 'Transportation', 'Layout', 'BASE', 'Short code'];
        const valueLines = afterSep.filter(l =>
            !SKIP_STARTS.some(s => l.startsWith(s)) &&
            l.length < 120
        );
        console.log('[PDF] Value lines after separator:', JSON.stringify(valueLines));

        if (valueLines[0])  product.part_number = valueLines[0];
        if (valueLines[4])  product.description  = valueLines[4];
        if (valueLines[5])  product.name         = valueLines[5];
        if (valueLines[7])  product.voltage      = valueLines[7];
        if (valueLines[8])  { product.ah = valueLines[8]; product.capacity = valueLines[8]; }
        if (valueLines[10]) product.cca          = valueLines[10];

        console.log('[PDF] Sequence mapping result:', product);
    }

    // ── Strategy 3: Dimension extraction from top section ────────────────────
    const lenMatch = fullText.match(/Max Length\s*\([^)]*\)\s*([\d,.]+)\s*mm/i);
    const widMatch = fullText.match(/Max Width\s*\([^)]*\)\s*([\d,.]+)\s*mm/i);
    const hgtMatch = fullText.match(/Max Height\s*[^\d]*([\d,.]+)\s*mm/i);
    if (lenMatch && widMatch && hgtMatch) {
        product.dimensions = `${lenMatch[1]}x${widMatch[1]}x${hgtMatch[1]} mm`;
        console.log('[PDF] Dimensions:', product.dimensions);
    }

    // ── Strategy 4: Technology line → battery_type ───────────────────────────
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

    // ── Build name ──
    if (product.brand && product.name && !product.name.includes(product.brand)) {
        product.name = `${product.brand} ${product.name}`;
    } else if (product.brand && !product.name && product.part_number) {
        product.name = `${product.brand} ${product.part_number}`;
    }

    // ── Build description ──
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
        const protocol = req.protocol;
        const host = req.get('host');
        const currentBatteryIconUrl = `${protocol}://${host}/icons/eletro-battery-tile-1024.png`;

        for (const file of files) {
            const ext = file.originalname.split('.').pop().toLowerCase();
            const isPDF = ext === 'pdf' || file.mimetype === 'application/pdf';
            console.log(`[Bulk Upload] Processing: ${file.originalname} | isPDF: ${isPDF}`);

            if (isPDF) {
                let products;
                if (process.env.OPENAI_API_KEY) {
                    try {
                        console.log(`[Bulk Upload] Using OpenAI Vision parser for: ${file.originalname}`);
                        products = await extractFromPDFWithAI(file.buffer, file.originalname, protocol, host);
                    } catch (aiErr) {
                        console.error(`[Bulk Upload] OpenAI Vision failed, falling back to legacy parser: ${aiErr.message}`);
                        products = await extractFromPDF(file.buffer, file.originalname, currentBatteryIconUrl);
                    }
                } else {
                    console.log(`[Bulk Upload] OpenAI API key not found, using legacy parser for: ${file.originalname}`);
                    products = await extractFromPDF(file.buffer, file.originalname, currentBatteryIconUrl);
                }
                console.log(`[Bulk Upload] ${file.originalname} → ${products.length} product(s)`);
                allFormattedProducts.push(...products);
            } else {
                const workbook = xlsx.read(file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
                console.log(`[Bulk Upload] ${file.originalname} → ${rows.length} row(s)`);
                if (rows.length > 0) allFormattedProducts.push(...rows.map(row => mapRowToProduct(row, currentBatteryIconUrl)));
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
                    image: currentBatteryIconUrl,
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

const clearAllData = async (req, res) => {
    try {
        console.log('[Clear All] Clearing products...');
        await Product.deleteMany({});

        console.log('[Clear All] Clearing brands...');
        await Brand.deleteMany({});

        console.log('[Clear All] Resetting counters...');
        const Counter = require('../models/CounterModel');
        await Counter.deleteMany({ id: { $in: ['product_id', 'brand_id'] } });

        console.log('[Clear All] Running auto-seeding...');
        const autoSeed = require('../config/autoSeed');
        await autoSeed();

        res.status(200).json({
            status: true,
            message: 'All products and custom brands cleared, default seeds re-applied successfully.'
        });
    } catch (error) {
        console.error('[Clear All] Error:', error.message);
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
    clearAllData,
};
