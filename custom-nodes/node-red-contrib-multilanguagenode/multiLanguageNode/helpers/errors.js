function handleExecutionError(err, msg, done) {
  if (typeof err === "object" && err.hasOwnProperty("stack")) {
    // Remove unwanted part
    var index = err.stack.search(
      /\n\s*at ContextifyScript.Script.runInContext/
    );
    err.stack = err.stack.slice(0, index).split("\n").slice(0, -1).join("\n");
    var stack = err.stack.split(/\r?\n/);

    msg.error = err;
    if (stack.length > 0) {
      let line = 0;
      let errorMessage;
      while (
        line < stack.length &&
        stack[line].indexOf("ReferenceError") !== 0
      ) {
        line++;
      }

      if (line < stack.length) {
        errorMessage = stack[line];
        var m = /:(\d+):(\d+)$/.exec(stack[line + 1]);
        if (m) {
          var lineno = Number(m[1]) - 1;
          var cha = m[2];
          errorMessage += " (line " + lineno + ", col " + cha + ")";
        }
      }
      if (errorMessage) {
        err.message = errorMessage;
      }
    }
    // Pass the whole error object so any additional properties
    // (such as cause) are preserved
    done(err);
  } else if (typeof err === "string") {
    done(err);
  } else {
    done(JSON.stringify(err));
  }
}

module.exports = { handleExecutionError };
