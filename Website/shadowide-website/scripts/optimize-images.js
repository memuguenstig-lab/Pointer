const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '../public/images');
const outputDir = path.join(__dirname, '../public/images/optimized');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    const { width, height, quality } = options;
    console.log(`Optimizing: ${path.basename(inputPath)}`);
    
    await sharp(inputPath)
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: quality || 80 })
      .toFile(outputPath);
    
    // Get file sizes for comparison
    const originalSize = fs.statSync(inputPath).size;
    const optimizedSize = fs.statSync(outputPath).size;
    const savedPercentage = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    
    console.log(`Optimized ${path.basename(inputPath)}: ${(originalSize / 1024).toFixed(2)}KB → ${(optimizedSize / 1024).toFixed(2)}KB (${savedPercentage}% smaller)`);
  } catch (error) {
    console.error(`Error optimizing ${inputPath}:`, error);
  }
}

async function optimizeImages() {
  try {
    const files = fs.readdirSync(inputDir);
    
    for (const file of files) {
      if (!file.match(/\.(png|jpg|jpeg)$/i)) continue;
      
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, `${path.basename(file, path.extname(file))}.webp`);
      
      // Optimize based on file name
      if (file === 'metadata.png') {
        await optimizeImage(inputPath, outputPath, { width: 1200, height: 630, quality: 85 });
      } else if (file === 'preview.png') {
        await optimizeImage(inputPath, outputPath, { width: 1200, height: 600, quality: 85 });
      } else if (file === 'logo.png') {
        await optimizeImage(inputPath, outputPath, { width: 112, height: 112, quality: 90 });
      } else {
        await optimizeImage(inputPath, outputPath);
      }
    }
    
    console.log('Image optimization complete!');
  } catch (error) {
    console.error('Error optimizing images:', error);
  }
}

optimizeImages(); 