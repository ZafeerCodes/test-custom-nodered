const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

function executeCpp(code, node) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(__dirname, "temp.cpp");
    fs.writeFileSync(tempFile, code);
    exec(`g++ ${tempFile} -o temp && ./temp`, (error, stdout, stderr) => {
      if (error) {
        node.error(`C++ error: ${stderr}`);
        return reject(new Error(`C++ execution failed: ${stderr}`));
      }

      try {
        console.log(stdout);
        let result = JSON.parse(`${stdout}`);
        if (typeof result === "object") {
          resolve(result);
        } else {
          resolve(undefined);
        }
      } catch (parseError) {
        node.error(`Output parsing error: ${parseError.message}`);
        reject(new Error(`Output parsing failed: ${parseError.message}`));
      }
    });
  });
}

module.exports = executeCpp;
