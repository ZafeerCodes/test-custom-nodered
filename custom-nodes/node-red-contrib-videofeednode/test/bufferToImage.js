const fs = require('fs');
const path = require('path');

module.exports.saveBufferToJpegFile = function(buffer, fileName) {
  const filePath = path.join(__dirname, `${fileName}.jpg`);
  fs.writeFileSync(filePath, buffer);
  fs.chmodSync(filePath, '0666');
  return filePath;
  console.log(`Buffer saved as ${filePath}`);
};