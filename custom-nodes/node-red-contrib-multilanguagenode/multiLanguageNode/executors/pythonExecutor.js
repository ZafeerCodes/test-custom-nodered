const { exec } = require("child_process");
const { checkMainFunctionReturn } = require("./helpers");
const path = require("path");
const fs = require("fs");
let filePath = path.join(__dirname, "temp.py");

async function executePython(code, node, msg, send, done) {
  const pythonMsg = JSON.stringify(formatJsToPython(msg || "undefined")) ;
  const pythonNode = JSON.stringify(formatJsToPython(node || "undefined"));
  const pythonSend = formatJsToPython(send || "undefined");
  const pythonDone = formatJsToPython(done || "undefined");

  code =
    `msg = ${pythonMsg}\n` +
    `__node__ = ${pythonNode}\n` +
    `__send__ = ${pythonSend}\n` +
    `__done__ = ${pythonDone}\n` +
    code +
    "\n";

  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    exec(`python3 ${filePath}`, (error, stdout, stderr) => {
      if (error) {
        console.log(error, "error");
        return reject(new Error(`Python execution failed: ${stderr}`));
      }

      try {
        let results = stdout.split("\n").find((res) => {
          if (isValidJSONObject(res)) {
            const parsed = JSON.parse(res);
            if (parsed.type === "main") {
              return true; 
            }
          }
          return false;  
        });
        
        if (results) {
          results = JSON.parse(results);  
        }
        
        if (results && typeof results.results === "object") {
          resolve(results?.results);
        } else {
          resolve(undefined);
        }
      } catch (parseError) {
        console.log(parseError.message, "error");
        reject(new Error(`Output parsing failed: ${parseError.message}`));
      }
    });
  });
}

function isValidJSONObject(response) {
  try {
    const parsed = JSON.parse(response);
    return typeof parsed === 'object' && parsed !== null;
  } catch (error) {
    return false;
  }
}

function formatJsToPython(jsObj) {
  const keywordMapping = {
    null: "None",          
    undefined: "None",    
    false: "False",       
    true: "True",         
  };

  function replaceKeywords(value) {
    if (value === null || value === "null") {
      return keywordMapping["null"]; 
    } else if (value === undefined || value === "undefined") {
      return keywordMapping["undefined"];
    } else if (value === true || value === "true") {
      return keywordMapping["true"];
    } else if (value === false || value === "false") {
      return keywordMapping["false"];
    } else if (Array.isArray(value)) {
      return value.map(replaceKeywords);
    } else if (typeof value === "object" && value !== null) {
      const newObj = {};
      for (let key in value) {
        newObj[key] = replaceKeywords(value[key]);
      }
      return newObj;
    }
    return value;
  }

  return replaceKeywords(jsObj);
}

module.exports = executePython;
