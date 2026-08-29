// Read a File/Blob, downscale it, and return { base64, mimeType, dataUrl }
export function fileToResizedBase64(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, 0.9);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType, dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
