import sharp from 'sharp';

export async function compressImage(base64String: string, maxSizeKB: number = 800): Promise<string> {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Calculate new dimensions (max 1024px on longest side)
    let width = metadata.width || 1024;
    let height = metadata.height || 1024;
    const maxDimension = 1024;
    
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    
    // Compress and resize image
    let quality = 85;
    let compressedBuffer: Buffer;
    let size: number;
    
    do {
      compressedBuffer = await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toBuffer();
      
      size = compressedBuffer.length / 1024; // Convert to KB
      quality -= 5;
    } while (size > maxSizeKB && quality > 20);
    
    // Convert back to base64
    return compressedBuffer.toString('base64');
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original if compression fails
    return base64String;
  }
}

export async function resizeImageForUpload(base64String: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    
    // Resize to max 1024px maintaining aspect ratio
    const resizedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    return resizedBuffer.toString('base64');
  } catch (error) {
    console.error('Error resizing image:', error);
    return base64String;
  }
}