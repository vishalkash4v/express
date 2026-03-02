const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');

// Maximum file size: 15MB (for upscaler), 8MB (for compressor)
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes
const MAX_FILE_SIZE_MB = 15;
const MAX_DIMENSION = 8000; // Max width or height in pixels (for upscaler)

// Compressor specific limits (increased to match upscaler)
const MAX_COMPRESSOR_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes
const MAX_COMPRESSOR_FILE_SIZE_MB = 15;
const MAX_COMPRESSOR_DIMENSION = 4000; // Max width or height in pixels
const MAX_SMART_RESIZE_DIMENSION = 3000; // Max dimension for smart resize

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

// Helper function to handle multer errors
const handleMulterError = (err, res) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: `File too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload error'
    });
  }
  // Handle other errors (like fileFilter errors)
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Invalid file'
    });
  }
};

// Helper to convert buffer to base64
const bufferToBase64 = (buffer, mimeType) => {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

// Image Upscaler API - Redesigned for Vercel
router.post('/upscale', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(413).json({ 
        success: false, 
        error: `File too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.` 
      });
    }

    // Parse request parameters
    const { scale, mode, enhancementLevel } = req.body;
    const scaleFactor = scale === '4x' ? 4 : scale === '2x' ? 2 : 2; // Default to 2x
    const enhancementMode = mode === 'illustration' ? 'illustration' : 'photo'; // Default to photo
    const enhancement = Math.max(0, Math.min(100, parseFloat(enhancementLevel) || 50)); // 0-100, default 50

    let sharpInstance = sharp(req.file.buffer);

    // Get original dimensions
    const metadata = await sharpInstance.metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Validate dimensions
    if (!originalWidth || !originalHeight) {
      return res.status(400).json({ success: false, error: 'Invalid image dimensions' });
    }

    // Reject images larger than MAX_DIMENSION
    if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
      return res.status(400).json({ 
        success: false, 
        error: `Image dimensions too large. Maximum dimension is ${MAX_DIMENSION}px.` 
      });
    }

    // Calculate new dimensions
    const newWidth = Math.round(originalWidth * scaleFactor);
    const newHeight = Math.round(originalHeight * scaleFactor);

    // Validate output dimensions don't exceed limits (allow up to 4x scale)
    const maxOutputDimension = MAX_DIMENSION * 4; // Allow 4x upscale of max dimension
    if (newWidth > maxOutputDimension || newHeight > maxOutputDimension) {
      return res.status(400).json({ 
        success: false, 
        error: `Output dimensions too large. Maximum output dimension is ${maxOutputDimension}px.` 
      });
    }

    // Map enhancement level (0-100) to sharpening sigma (0.5-3.0)
    let sharpeningSigma = 0.5 + (enhancement / 100) * 2.5;
    
    // Mode-specific adjustments
    if (enhancementMode === 'illustration') {
      // Stronger sharpening for illustrations
      sharpeningSigma = Math.min(3.5, sharpeningSigma * 1.2);
    } else {
      // Photo mode - moderate sharpening
      sharpeningSigma = Math.min(2.5, sharpeningSigma * 0.9);
    }

    // Configure sharpening (sharp uses sigma for sharpen)
    const sharpenConfig = {
      sigma: sharpeningSigma,
      flat: 1,
      jagged: 2
    };

    // Build processing pipeline
    let pipeline = sharpInstance
      .resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill',
        withoutEnlargement: false
      });

    // Apply sharpening
    pipeline = pipeline.sharpen(sharpenConfig);

    // Apply mode-specific enhancements
    if (enhancementMode === 'photo') {
      // Photo mode: Moderate sharpening, slight saturation boost, subtle contrast
      pipeline = pipeline
        .modulate({
          brightness: 1.02, // Slight brightness boost
          saturation: 1.05 + (enhancement / 100) * 0.1, // Slight saturation boost
        })
        .normalise(); // Normalize contrast
    } else {
      // Illustration mode: Stronger sharpening, stronger edge enhancement, higher saturation
      pipeline = pipeline
        .modulate({
          brightness: 1.01,
          saturation: 1.08 + (enhancement / 100) * 0.15, // Higher saturation
        })
        .normalise();
    }

    // Convert to WebP with quality 95
    const upscaledBuffer = await pipeline
      .webp({ quality: 95, effort: 4 })
      .toBuffer();

    const processingTime = Date.now() - startTime;
    
    // Check if processing took too long (should be under 2 seconds)
    if (processingTime > 2000) {
      console.warn(`Upscaling took ${processingTime}ms (target: <2000ms)`);
    }

    const base64 = bufferToBase64(upscaledBuffer, 'image/webp');

    res.json({
      success: true,
      data: base64,
      originalSize: { width: originalWidth, height: originalHeight },
      newSize: { width: newWidth, height: newHeight },
      sizeKB: (upscaledBuffer.length / 1024).toFixed(2),
      processingTime: processingTime,
      scale: scaleFactor,
      mode: enhancementMode,
      enhancement: enhancement
    });
  } catch (error) {
    console.error('Upscale error:', error);
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      return handleMulterError(error, res);
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to upscale image' });
  }
});

// Image Compressor API - Redesigned for Vercel
router.post('/compress', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    // Validate file size
    if (req.file.size > MAX_COMPRESSOR_FILE_SIZE) {
      return res.status(413).json({ 
        success: false, 
        error: `File too large. Maximum file size is ${MAX_COMPRESSOR_FILE_SIZE_MB}MB.` 
      });
    }

    // Parse request parameters
    const { 
      mode, // 'auto', 'targetSize', 'manual'
      quality, // 10-100 for manual mode
      targetSizeKB, // for targetSize mode
      format, // 'jpg', 'webp', 'png' for manual mode
      removeMetadata, // boolean
      progressive, // boolean (for JPEG)
      smartResize, // boolean
      preset // 'instagram-post', 'instagram-story', 'youtube-thumbnail', 'whatsapp'
    } = req.body;

    const compressionMode = mode || 'auto';
    const shouldRemoveMetadata = removeMetadata !== 'false';
    const shouldProgressive = progressive === 'true';
    const shouldSmartResize = smartResize === 'true';

    let sharpInstance = sharp(req.file.buffer);

    // Get original metadata
    const metadata = await sharpInstance.metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const originalSizeKB = req.file.size / 1024;

    // Validate dimensions
    if (!originalWidth || !originalHeight) {
      return res.status(400).json({ success: false, error: 'Invalid image dimensions' });
    }

    // Reject images larger than MAX_COMPRESSOR_DIMENSION
    if (originalWidth > MAX_COMPRESSOR_DIMENSION || originalHeight > MAX_COMPRESSOR_DIMENSION) {
      return res.status(400).json({ 
        success: false, 
        error: `Image dimensions too large. Maximum dimension is ${MAX_COMPRESSOR_DIMENSION}px.` 
      });
    }

    // Detect input format
    const inputMime = req.file.mimetype.toLowerCase();
    const inputFormat = inputMime.includes('jpeg') || inputMime.includes('jpg') ? 'jpg' :
                       inputMime.includes('png') ? 'png' :
                       inputMime.includes('webp') ? 'webp' : 'jpg';

    // Handle social media presets
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;
    let presetFormat = null;

    if (preset) {
      switch (preset) {
        case 'instagram-post':
          targetWidth = 1080;
          targetHeight = 1080;
          presetFormat = 'jpg';
          break;
        case 'instagram-story':
          targetWidth = 1080;
          targetHeight = 1920;
          presetFormat = 'jpg';
          break;
        case 'youtube-thumbnail':
          targetWidth = 1280;
          targetHeight = 720;
          presetFormat = 'jpg';
          break;
        case 'whatsapp':
          targetWidth = 1600;
          targetHeight = 1600;
          presetFormat = 'jpg';
          break;
      }
    }

    // Smart resize if enabled and image is large
    if (shouldSmartResize && (originalWidth > MAX_SMART_RESIZE_DIMENSION || originalHeight > MAX_SMART_RESIZE_DIMENSION)) {
      const scale = Math.min(
        MAX_SMART_RESIZE_DIMENSION / originalWidth,
        MAX_SMART_RESIZE_DIMENSION / originalHeight
      );
      targetWidth = Math.round(originalWidth * scale);
      targetHeight = Math.round(originalHeight * scale);
    }

    // Apply resize if needed
    if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
      sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Remove metadata if requested (but preserve alpha channel for transparency)
    if (shouldRemoveMetadata) {
      sharpInstance = sharpInstance.withMetadata({});
    }

    let outputFormat = format || 'webp';
    let outputMime = 'image/webp';
    let outputOptions = {};
    let outputBuffer;

    // AUTO MODE: Smart format selection
    if (compressionMode === 'auto') {
      // Try WebP first (best compression)
      const webpBuffer = await sharpInstance
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      const webpSizeKB = webpBuffer.length / 1024;

      // Try JPEG
      const jpegBuffer = await sharpInstance
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      const jpegSizeKB = jpegBuffer.length / 1024;

      // Choose best format
      if (inputFormat === 'png' && metadata.hasAlpha) {
        // Preserve PNG if has transparency
        const pngBuffer = await sharpInstance
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer();
        const pngSizeKB = pngBuffer.length / 1024;

        if (webpSizeKB < pngSizeKB && webpSizeKB < jpegSizeKB) {
          outputFormat = 'webp';
          outputMime = 'image/webp';
          outputOptions = { quality: 85, effort: 4 };
          outputBuffer = webpBuffer;
        } else if (pngSizeKB < jpegSizeKB) {
          outputFormat = 'png';
          outputMime = 'image/png';
          outputOptions = { compressionLevel: 9, adaptiveFiltering: true };
          outputBuffer = pngBuffer;
        } else {
          outputFormat = 'jpg';
          outputMime = 'image/jpeg';
          outputOptions = { quality: 85, mozjpeg: true };
          outputBuffer = jpegBuffer;
        }
      } else {
        // No transparency, choose best compression
        if (webpSizeKB < jpegSizeKB) {
          outputFormat = 'webp';
          outputMime = 'image/webp';
          outputOptions = { quality: 85, effort: 4 };
          outputBuffer = webpBuffer;
        } else {
          outputFormat = 'jpg';
          outputMime = 'image/jpeg';
          outputOptions = { quality: 85, mozjpeg: true };
          outputBuffer = jpegBuffer;
        }
      }
    }
    // TARGET SIZE MODE
    else if (compressionMode === 'targetSize') {
      const targetKB = parseFloat(targetSizeKB);
      if (!targetKB || targetKB <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid target size. Please provide a valid target size in KB.' 
        });
      }

      // Use preset format or default to WebP
      const finalFormat = presetFormat || format || 'webp';
      outputFormat = finalFormat;
      
      if (finalFormat === 'jpg' || finalFormat === 'jpeg') {
        outputMime = 'image/jpeg';
        // Binary search for quality (max 5 iterations for speed)
        let low = 10;
        let high = 100;
        let bestBuffer = null;
        let bestDiff = Infinity;

        for (let i = 0; i < 5; i++) {
          const mid = Math.round((low + high) / 2);
          const testBuffer = await sharpInstance
            .jpeg({ quality: mid, mozjpeg: true, progressive: shouldProgressive })
            .toBuffer();
          
          const testSizeKB = testBuffer.length / 1024;
          const diff = Math.abs(testSizeKB - targetKB);

          if (diff < bestDiff) {
            bestDiff = diff;
            bestBuffer = testBuffer;
          }

          if (testSizeKB > targetKB) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }

          if (diff < 2) break; // Close enough
        }

        outputBuffer = bestBuffer || await sharpInstance
          .jpeg({ quality: 50, mozjpeg: true, progressive: shouldProgressive })
          .toBuffer();
      } else if (finalFormat === 'png') {
        outputMime = 'image/png';
        // PNG compression is limited, may need resize
        let currentBuffer = await sharpInstance
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer();
        let currentSizeKB = currentBuffer.length / 1024;

        if (currentSizeKB > targetKB) {
          // Reduce dimensions to meet target
          const scale = Math.sqrt(targetKB / currentSizeKB) * 0.9;
          const newWidth = Math.round(targetWidth * scale);
          const newHeight = Math.round(targetHeight * scale);
          
          outputBuffer = await sharp(req.file.buffer)
            .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toBuffer();
        } else {
          outputBuffer = currentBuffer;
        }
      } else {
        // WebP
        outputMime = 'image/webp';
        let low = 10;
        let high = 100;
        let bestBuffer = null;
        let bestDiff = Infinity;

        for (let i = 0; i < 5; i++) {
          const mid = Math.round((low + high) / 2);
          const testBuffer = await sharpInstance
            .webp({ quality: mid, effort: 4 })
            .toBuffer();
          
          const testSizeKB = testBuffer.length / 1024;
          const diff = Math.abs(testSizeKB - targetKB);

          if (diff < bestDiff) {
            bestDiff = diff;
            bestBuffer = testBuffer;
          }

          if (testSizeKB > targetKB) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }

          if (diff < 2) break;
        }

        outputBuffer = bestBuffer || await sharpInstance
          .webp({ quality: 50, effort: 4 })
          .toBuffer();
      }
    }
    // MANUAL MODE
    else {
      const finalFormat = presetFormat || format || 'webp';
      outputFormat = finalFormat;
      const finalQuality = Math.max(10, Math.min(100, parseInt(quality) || 80));

      if (finalFormat === 'jpg' || finalFormat === 'jpeg') {
        outputMime = 'image/jpeg';
        outputBuffer = await sharpInstance
          .jpeg({ 
            quality: finalQuality, 
            mozjpeg: true, 
            progressive: shouldProgressive,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();
      } else if (finalFormat === 'png') {
        outputMime = 'image/png';
        const compressionLevel = Math.round((100 - finalQuality) / 10);
        outputBuffer = await sharpInstance
          .png({ 
            compressionLevel: Math.max(0, Math.min(9, compressionLevel)),
            adaptiveFiltering: true
          })
          .toBuffer();
      } else {
        // WebP
        outputMime = 'image/webp';
        outputBuffer = await sharpInstance
          .webp({ 
            quality: finalQuality,
            effort: 4
          })
          .toBuffer();
      }
    }

    const processingTime = Date.now() - startTime;
    
    // Check if processing took too long
    if (processingTime > 2000) {
      console.warn(`Compression took ${processingTime}ms (target: <2000ms)`);
    }

    const compressedSizeKB = outputBuffer.length / 1024;
    const compressionRatio = ((1 - compressedSizeKB / originalSizeKB) * 100).toFixed(1);
    const base64 = bufferToBase64(outputBuffer, outputMime);

    res.json({
      success: true,
      data: base64,
      originalSizeKB: originalSizeKB.toFixed(2),
      compressedSizeKB: compressedSizeKB.toFixed(2),
      compressionRatio: compressionRatio,
      format: outputFormat,
      processingTime: processingTime,
      originalDimensions: { width: originalWidth, height: originalHeight },
      compressedDimensions: { width: targetWidth, height: targetHeight }
    });
  } catch (error) {
    console.error('Compress error:', error);
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      return handleMulterError(error, res);
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to compress image' });
  }
});

// Image Blur API
router.post('/blur', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const blurValue = parseFloat(req.body.blur) || 6;
    const outputFormat = req.body.format || 'png';

    if (blurValue < 0 || blurValue > 100) {
      return res.status(400).json({ success: false, error: 'Blur value must be between 0 and 100' });
    }

    let outputMime = 'image/png';
    let outputOptions = {};

    if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
      outputMime = 'image/jpeg';
      outputOptions = { quality: 92, mozjpeg: true };
    } else if (outputFormat === 'webp') {
      outputMime = 'image/webp';
      outputOptions = { quality: 92 };
    } else {
      outputOptions = { compressionLevel: 9 };
    }

    const blurredBuffer = await sharp(req.file.buffer)
      .blur(blurValue)
      .toFormat(outputFormat === 'jpeg' || outputFormat === 'jpg' ? 'jpeg' : outputFormat, outputOptions)
      .toBuffer();

    const base64 = bufferToBase64(blurredBuffer, outputMime);

    res.json({
      success: true,
      data: base64,
      blurValue: blurValue,
      sizeKB: (blurredBuffer.length / 1024).toFixed(2)
    });
  } catch (error) {
    console.error('Blur error:', error);
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      return handleMulterError(error, res);
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to blur image' });
  }
});

module.exports = router;
