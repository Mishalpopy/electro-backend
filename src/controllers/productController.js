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
// DuckDuckGo Image Search & Download Helper
// ─────────────────────────────────────────────────────────────────────────────
const searchDuckDuckGoImages = async (query) => {
    console.log('[Image Search] Querying DDG for:', query);
    try {
        const response = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
        const html = await response.text();
        
        // Extract VQD using a regex
        const vqdMatch = html.match(/vqd=['"]?([\d-]+)['"]?/);
        if (!vqdMatch) throw new Error("Could not extract VQD token");
        const vqd = vqdMatch[1];

        // Fetch image results using the VQD
        const searchUrl = new URL("https://duckduckgo.com/i.js");
        searchUrl.searchParams.append("l", "wt-wt");
        searchUrl.searchParams.append("o", "json");
        searchUrl.searchParams.append("q", query);
        searchUrl.searchParams.append("vqd", vqd);
        searchUrl.searchParams.append("f", ",,,");
        searchUrl.searchParams.append("p", "1");

        const imageResponse = await fetch(searchUrl);
        const data = await imageResponse.json();
        
        return data.results || [];
    } catch (err) {
        console.error('[Image Search] Error searching DuckDuckGo:', err.message);
        return [];
    }
};

const getSearchProductImage = async (brand, name, partNumber) => {
    const query = `${brand} ${partNumber || name} battery`;
    const results = await searchDuckDuckGoImages(query);
    
    if (!results || results.length === 0) {
        console.log('[Image Search] No results found for:', query);
        return null;
    }

    // Try fetching from the first few image results
    for (let i = 0; i < Math.min(results.length, 5); i++) {
        const imageUrl = results[i].image;
        console.log(`[Image Search] Attempting download ${i + 1}/${Math.min(results.length, 5)}: ${imageUrl}`);
        
        try {
            const res = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(5000) // 5s timeout
            });

            if (!res.ok) {
                console.log(`[Image Search] Download failed: HTTP ${res.status}`);
                continue;
            }

            const arrayBuffer = await res.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);

            console.log('[Image Search] Image downloaded. Processing with Jimp...');
            const img = await Jimp.read(imageBuffer);
            
            // Pad to a square transparent canvas
            const maxDim = Math.max(img.bitmap.width, img.bitmap.height);
            const squareImage = new Jimp({ width: maxDim, height: maxDim });
            const posX = Math.round((maxDim - img.bitmap.width) / 2);
            const posY = Math.round((maxDim - img.bitmap.height) / 2);
            squareImage.composite(img, posX, posY);

            // Ensure static uploads folder exists
            const uploadDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const uniqueFilename = `battery-search-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
            const savePath = path.join(uploadDir, uniqueFilename);
            await squareImage.write(savePath);

            console.log(`[Image Search] Saved square image successfully to: ${savePath}`);
            return uniqueFilename;
        } catch (err) {
            console.error(`[Image Search] Error downloading result ${i + 1}:`, err.message);
        }
    }
    
    return null;
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
    "x": "The starting X coordinate of ONLY the physical battery body/product as a percentage of page width (0 to 100)",
    "y": "The starting Y coordinate of ONLY the physical battery body/product as a percentage of page height (0 to 100)",
    "width": "The width of ONLY the physical battery body/product as a percentage of page width (0 to 100)",
    "height": "The height of ONLY the physical battery body/product as a percentage of page height (0 to 100)"
  }
}

Important details for crop_box:
- The specification sheet has a header banner at the top (occupying roughly the top 12% of the page).
- Inside this top header, there are battery images located in the center-right section (around X = 48% to 62%, and Y = 3% to 11%).
- Your crop_box coordinates must be extremely tight around ONLY these physical battery objects (specifically the larger battery on the right, or both together if they are adjacent).
- DO NOT crop the "Energizer" logo on the far left of the header.
- DO NOT include the red background wedge/banner on the right side of the batteries.
- DO NOT include the red horizontal "Product Data Sheet" banner or stripe below the header.
- The crop box should start at the very top of the battery handle/terminals and end at the bottom edge of the battery's black base.
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
    let imageSaved = false;

    // 4. Try to search and download product image online first
    if (parsedResult.brand && (parsedResult.part_number || parsedResult.name)) {
        try {
            console.log('[AI PDF] Searching for product image online...');
            const searchFilename = await getSearchProductImage(
                parsedResult.brand,
                parsedResult.name,
                parsedResult.part_number
            );
            if (searchFilename) {
                finalImageUrl = `${protocol}://${host}/uploads/${searchFilename}`;
                imageSaved = true;
                console.log('[AI PDF] Online image search & download succeeded. URL:', finalImageUrl);
            }
        } catch (searchErr) {
            console.error('[AI PDF] Online image search/download failed:', searchErr.message);
        }
    }

    // 5. If online search failed, crop the image using Jimp from PDF (OpenAI Vision fallback)
    if (!imageSaved && parsedResult.crop_box && typeof parsedResult.crop_box === 'object') {
        const { x, y, width: boxWidth, height: boxHeight } = parsedResult.crop_box;
        
        // Convert to numbers
        const pctX = parseFloat(x);
        const pctY = parseFloat(y);
        const pctW = parseFloat(boxWidth);
        const pctH = parseFloat(boxHeight);

        if (!isNaN(pctX) && !isNaN(pctY) && !isNaN(pctW) && !isNaN(pctH) && pctW > 1 && pctH > 1) {
            try {
                console.log('[AI PDF] Initializing Jimp to crop battery image as fallback...');
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

                // Make the cropped image square by centering it on a transparent square canvas
                const maxDim = Math.max(image.bitmap.width, image.bitmap.height);
                const squareImage = new Jimp({ width: maxDim, height: maxDim });
                const posX = Math.round((maxDim - image.bitmap.width) / 2);
                const posY = Math.round((maxDim - image.bitmap.height) / 2);
                squareImage.composite(image, posX, posY);

                // Ensure static uploads folder exists
                const uploadDir = path.join(__dirname, '../uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                // Save square image
                const uniqueFilename = `battery-ai-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
                const savePath = path.join(uploadDir, uniqueFilename);
                await squareImage.write(savePath);

                finalImageUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;
                imageSaved = true;
                console.log(`[AI PDF] Cropped square image saved successfully to: ${savePath}`);
            } catch (jimpErr) {
                console.error('[AI PDF] Jimp cropping fallback failed, using default battery icon:', jimpErr.message);
            }
        }
    }

    // 6. Format product object for database insertion
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

    // If we haven't extracted any products via lists/tables, try extracting via DIN/JIS regexes (useful for guides/spec sheets listing multiple part numbers)
    const dinRegex = /DIN\d{2,3}[H|L]?/gi;
    const jisRegex = /\b\d{2,3}[A-Z]\d{2}[R|L]?\b/gi;

    const matchedParts = new Set();
    let rMatch;
    while ((rMatch = dinRegex.exec(fullText)) !== null) {
        matchedParts.add(rMatch[0].toUpperCase());
    }
    while ((rMatch = jisRegex.exec(fullText)) !== null) {
        matchedParts.add(rMatch[0].toUpperCase());
    }

    if (matchedParts.size > 0) {
        const finalBrand = filenameBrand || textBrand || product.brand || 'Unknown';
        const regexProducts = Array.from(matchedParts).map(part => {
            return {
                brand: finalBrand,
                part_number: part,
                name: `${finalBrand} ${part}`,
                price: 0,
                voltage: '12 V',
                battery_type: part.startsWith('DIN') ? 'Flooded / DIN' : 'Flooded / JIS',
                description: `${finalBrand} Battery | Part: ${part}`,
                stock_status: 'In Stock',
                type: 'battery',
                image: batteryIconUrl,
                images: []
            };
        });
        console.log(`[PDF] DIN/JIS regex extraction matched! Extracted ${regexProducts.length} products.`);
        return regexProducts;
    }

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
                const legacyProducts = await extractFromPDF(file.buffer, file.originalname, currentBatteryIconUrl);
                
                // If the legacy parser extracted more than 1 product, it's a text-based multi-product sheet/price-list
                if (legacyProducts.length > 1) {
                    console.log(`[Bulk Upload] Multi-product price-list detected (${legacyProducts.length} items). Using legacy text parser for: ${file.originalname}`);
                    products = legacyProducts;
                } else if (process.env.OPENAI_API_KEY) {
                    try {
                        console.log(`[Bulk Upload] Attempting OpenAI Vision parser for: ${file.originalname}`);
                        products = await extractFromPDFWithAI(file.buffer, file.originalname, protocol, host);
                        
                        // If OpenAI Vision skipped it (e.g. general brochure/guide) and returned 0 products, 
                        // fallback to whatever the legacy parser could extract (usually 0 or 1 product)
                        if (products.length === 0) {
                            console.log(`[Bulk Upload] OpenAI Vision skipped product. Falling back to legacy parser results: ${file.originalname}`);
                            products = legacyProducts;
                        }
                    } catch (aiErr) {
                        console.error(`[Bulk Upload] OpenAI Vision failed, falling back to legacy parser: ${aiErr.message}`);
                        products = legacyProducts;
                    }
                } else {
                    console.log(`[Bulk Upload] OpenAI API key not found, using legacy parser for: ${file.originalname}`);
                    products = legacyProducts;
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

        // Clean up and filter out empty/invalid products
        allFormattedProducts = allFormattedProducts.filter(p => {
            const hasBrand = p.brand && p.brand !== '-' && p.brand.trim() !== '';
            const hasName = p.name && p.name !== '-' && p.name.trim() !== '';
            const hasPartNum = p.part_number && p.part_number !== '-' && p.part_number.trim() !== '';
            return hasBrand || hasName || hasPartNum;
        });

        if (allFormattedProducts.length === 0) {
            return res.status(400).json({ status: false, message: 'Could not extract any products from the uploaded files.' });
        }

        // Auto-create brand if it doesn't exist in the list, or fetch its image if it uses the default icon
        const brandNames = [...new Set(allFormattedProducts.map(p => p.brand).filter(b => b && typeof b === 'string' && b.trim() !== '' && b.trim() !== '-'))];
        
        for (const brandName of brandNames) {
            const trimmedName = brandName.trim();
            let brandDoc = await Brand.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
            
            let brandImageUrl = currentBatteryIconUrl;
            
            // Check if brand doc needs a custom image (doesn't exist, or exists but uses the default icon)
            const needsCustomImage = !brandDoc || !brandDoc.image || brandDoc.image.includes('/icons/eletro-battery-tile');
            
            if (needsCustomImage) {
                console.log(`[Bulk Upload] Brand "${trimmedName}" needs a custom image. Searching DDG for brand battery image...`);
                try {
                    const searchFilename = await getSearchProductImage(trimmedName, trimmedName, '');
                    if (searchFilename) {
                        brandImageUrl = `${protocol}://${host}/uploads/${searchFilename}`;
                        console.log(`[Bulk Upload] Found brand battery image for "${trimmedName}":`, brandImageUrl);
                    }
                } catch (searchErr) {
                    console.error(`[Bulk Upload] Brand image search failed for "${trimmedName}":`, searchErr.message);
                }
            } else if (brandDoc) {
                brandImageUrl = brandDoc.image;
            }

            if (!brandDoc) {
                console.log(`[Bulk Upload] Brand "${trimmedName}" not on the list. Auto-creating...`);
                brandDoc = await Brand.create({
                    name: trimmedName,
                    image: brandImageUrl,
                    status: 'active'
                });
            } else if (needsCustomImage && brandImageUrl !== currentBatteryIconUrl) {
                console.log(`[Bulk Upload] Updating brand "${trimmedName}" image with custom image...`);
                brandDoc.image = brandImageUrl;
                await brandDoc.save();
            }

            // Assign brandImageUrl to any products of this brand that currently have the default icon
            for (const p of allFormattedProducts) {
                if (p.brand && p.brand.trim().toLowerCase() === trimmedName.toLowerCase()) {
                    if (!p.image || p.image.includes('/icons/eletro-battery-tile')) {
                        p.image = brandImageUrl;
                    }
                }
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
