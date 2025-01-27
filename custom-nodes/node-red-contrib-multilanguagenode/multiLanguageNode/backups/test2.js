const { exec } = require("child_process");
const vm = require("vm");

var results = null;

results = (async function (msg, __send__, __done__) {
  var __msgid__ = msg._msgid;
  var node = {
    id: __node__.id,
    name: __node__.name,
    path: __node__.path,
    outputCount: __node__.outputCount,
    log: __node__.log,
    error: __node__.error,
    warn: __node__.warn,
    debug: __node__.debug,
    trace: __node__.trace,
    on: __node__.on,
    status: __node__.status,
    send: function (msgs, cloneMsg) {
      __node__.send(__send__, __msgid__, msgs, cloneMsg);
    },
    done: __done__,
  };

  const sandbox = {
    runPython: function (code) {
      return new Promise((resolve, reject) => {
        const escapedCode = code.replace(/"/g, '\\"'); 

        exec(`python3 -c "${escapedCode}"`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Python error: ${stderr}`); // Log the error
            return reject(new Error(`Python execution failed: ${stderr}`));
          }

          console.log(`Python stdout: ${stdout}`);

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(
              new Error(`Failed to parse Python output: ${parseError.message}`)
            );
          }
        });
      });
    },
  };

  const script = new vm.Script(`
        const pythonCode = \`
import json

def main():
    return json.dumps(msg)

if __name__ == "__main__":
    print(main())
\`;
    
    runPython(pythonCode).then(result => {
        results = result; // Store the result in the outer context
    }).catch(err => {
        console.error('Execution Error:', err);
    });
    `);

  const context = vm.createContext(sandbox);
  context.msg = msg; // Pass the msg object to the context

  script.runInContext(context);

  // Wait for the Python code to finish execution
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjust the timeout as needed

  return results;
})(msg, __send__, __done__);
