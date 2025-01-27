const { exec } = require("child_process");

function executeMojo(code, node) {
  return new Promise((resolve, reject) => {
    const escapedCode = code.replace(/"/g, '\\"');

    exec(`mojo -e "${escapedCode}"`, (error, stdout, stderr) => {
      if (error) {
        node.error(`Mojo error: ${stderr}`);
        return reject(new Error(`Mojo execution failed: ${stderr}`));
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

module.exports = executeMojo;
