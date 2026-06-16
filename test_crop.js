const { Jimp } = require('jimp');

async function testSquare() {
    try {
        // Create a 10x20 rectangular mock image
        const rectImage = new Jimp({ width: 10, height: 20 });
        
        // Find max dimension
        const maxDim = Math.max(rectImage.bitmap.width, rectImage.bitmap.height);
        
        // Create transparent square canvas
        const squareImage = new Jimp({ width: maxDim, height: maxDim });
        
        // Center-align and composite
        const posX = Math.round((maxDim - rectImage.bitmap.width) / 2);
        const posY = Math.round((maxDim - rectImage.bitmap.height) / 2);
        
        console.log(`Compositing rect image (10x20) onto square canvas (${maxDim}x${maxDim}) at pos: x=${posX}, y=${posY}`);
        
        squareImage.composite(rectImage, posX, posY);
        console.log('Compositing successful!');
    } catch (err) {
        console.error('Error during compositing:', err);
    }
}

testSquare();
