const fs = require('fs');

function loadScript(language, filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

module.exports = loadScript;
