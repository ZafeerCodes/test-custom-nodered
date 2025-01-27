function isImageBuffer(buffer) {
    const signatures = {
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/png": [0x89, 0x50, 0x4e, 0x47],
      "image/gif": [0x47, 0x49, 0x46],
    };
  
    for (const format in signatures) {
      const signature = signatures[format];
      if (buffer.slice(0, signature.length).equals(Buffer.from(signature))) {
        return true;
      }
    }
    return false;
  }
  
  module.exports = { isImageBuffer };
  