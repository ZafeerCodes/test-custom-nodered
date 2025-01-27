function sendResults(RED, node, send, _msgid, msgs, cloneFirstMessage) {
  if (msgs == null) {
    return;
  } else if (!Array.isArray(msgs)) {
    msgs = [msgs];
  }
  var msgCount = 0;
  for (var m = 0; m < msgs.length; m++) {
    if (msgs[m]) {
      if (!Array.isArray(msgs[m])) {
        msgs[m] = [msgs[m]];
      }
      for (var n = 0; n < msgs[m].length; n++) {
        var msg = msgs[m][n];
        if (msg !== null && msg !== undefined) {
          if (
            typeof msg === "object" &&
            !Buffer.isBuffer(msg) &&
            !Array.isArray(msg)
          ) {
            if (msgCount === 0 && cloneFirstMessage !== false) {
              msgs[m][n] = RED.util.cloneMessage(msgs[m][n]);
              msg = msgs[m][n];
            }
            msg._msgid = _msgid;
            msgCount++;
          } else {
            var type = typeof msg;
            if (type === "object") {
              type = Buffer.isBuffer(msg)
                ? "Buffer"
                : Array.isArray(msg)
                ? "Array"
                : "Date";
            }
            node.error("Error while sending message!");
          }
        }
      }
    }
  }
  if (msgCount > 0) {
    send(msgs);
  }
}

function createVMOpt(node, kind) {
  var opt = {
    filename:
      "MultiLanguages node" +
      kind +
      ":" +
      node.id +
      (node.name ? " [" + node.name + "]" : ""),
    displayErrors: true,
    // Using the following options causes node 4/6 to not include the line number
    // in the stack output. So don't use them.
    // lineOffset: -11, // line number offset to be used for stack traces
    // columnOffset: 0, // column number offset to be used for stack traces
  };
  return opt;
}

function updateErrorInfo(err) {
  if (err.stack) {
    var stack = err.stack.toString();
    var m = /^([^:]+):([^:]+):(\d+).*/.exec(stack);
    if (m) {
      var line = parseInt(m[3]) - 1;
      var kind = "body:";
      if (/setup/.exec(m[1])) {
        kind = "setup:";
      }
      if (/cleanup/.exec(m[1])) {
        kind = "cleanup:";
      }
      err.message += " (" + kind + "line " + line + ")";
    }
  }
}

module.exports = { sendResults, createVMOpt, updateErrorInfo };
