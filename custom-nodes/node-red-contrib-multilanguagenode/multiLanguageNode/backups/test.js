const { exec } = require("child_process");
const vm = require("vm");

const jsVar1 = "Hello from JavaScript!";
const jsVar2 = 42;

// Create a sandbox with a results holder
const sandbox = {
  results: null,
  runPython: function (code) {
    return new Promise((resolve, reject) => {
      const escapedCode = code.replace(/"/g, '\\"'); // Escape double quotes

      exec(`python3 -c "${escapedCode}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Python error: ${stderr}`); // Log the error
          return reject(new Error(`Python execution failed: ${stderr}`));
        }

        // Debug: print stdout before parsing
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

# Pass variables from JavaScript context
js_var1 = "${jsVar1}"
js_var2 = ${jsVar2}


def main():
    return json.dumps({"message": js_var1, "number": js_var2})

if __name__ == "__main__":
    print(main())
\`;

    runPython(pythonCode).then(result => {
        results = result;
    }).catch(err => {
        console.error('Execution Error:', err);
    });
`);

const context = vm.createContext(sandbox);


// Run the script within the context
script.runInContext(context);

// After executing the script, you can access context.results
setTimeout(() => {
  console.log('Context results:', context.results);
}, 100); // Delay to allow async operation to complete



// console.log('Context results:', context.results);