/**
 * Image Optimizer utility
 * Resizes, crops to square, and compresses avatar images into lightweight WebP/JPEG data URIs.
 * This prevents Firestore quota waste, reduces network bandwidth, and keeps documents well under limits.
 */
export async function optimizeAvatarImage(file: File, maxDimension: number = 160, quality: number = 0.82): Promise<{
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format file gambar tidak valid atau rusak.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = maxDimension;
          canvas.height = maxDimension;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('Canvas 2D context tidak tersedia.'));
          }

          // Calculate center square crop
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          // High quality smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw cropped and scaled image
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDimension, maxDimension);

          // Export as WebP if supported, fallback to JPEG
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const head = dataUrl.indexOf(',');
          const base64Len = dataUrl.length - (head + 1);
          const compressedSizeBytes = Math.round((base64Len * 3) / 4);

          resolve({
            dataUrl,
            originalSizeBytes: file.size,
            compressedSizeBytes,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
