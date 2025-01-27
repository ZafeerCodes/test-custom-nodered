const executePython = require("../executors/pythonExecutor");

function sandBoxFunc(node, RED, util) {
  try {
    if (!node || !RED || !util) {
      return;
    }

    return {
      console: console,
      util: util,
      Buffer: Buffer,
      Date: Date,
      RED: {
        util: RED?.util,
      },
      __node__: {
        id: node.id,
        name: node.name,
        path: node._path,
        outputCount: node.outputs,
        log: function () {
          try {
            node.log.apply(node, arguments);
          } catch (err) {
            console.error("Error in log:", err);
          }
        },
        error: function () {
          try {
            node.error.apply(node, arguments);
          } catch (err) {
            console.error("Error in error:", err);
          }
        },
        warn: function () {
          try {
            node.warn.apply(node, arguments);
          } catch (err) {
            console.error("Error in warn:", err);
          }
        },
        debug: function () {
          try {
            node.debug.apply(node, arguments);
          } catch (err) {
            console.error("Error in debug:", err);
          }
        },
        trace: function () {
          try {
            node.trace.apply(node, arguments);
          } catch (err) {
            console.error("Error in trace:", err);
          }
        },
        send: function (send, id, msgs, cloneMsg) {
          try {
            sendResults(node, send, id, msgs, cloneMsg);
          } catch (err) {
            node.error(err, {});
          }
        },
        on: function () {
          try {
            if (arguments[0] === "input") {
              throw new Error("Error: Input Listener");
            }
            node.on.apply(node, arguments);
          } catch (err) {
            console.error("Error in on:", err);
          }
        },
        status: function () {
          try {
            node.clearStatus = true;
            node.status.apply(node, arguments);
          } catch (err) {
            console.error("Error in status:", err);
          }
        },
      },
      context: {
        set: function () {
          try {
            node.context().set.apply(node, arguments);
          } catch (err) {
            console.error("Error in context.set:", err);
          }
        },
        get: function () {
          try {
            return node.context().get.apply(node, arguments);
          } catch (err) {
            console.error("Error in context.get:", err);
          }
        },
        keys: function () {
          try {
            return node.context().keys.apply(node, arguments);
          } catch (err) {
            console.error("Error in context.keys:", err);
          }
        },
        get global() {
          return node.context().global;
        },
        get flow() {
          return node.context().flow;
        },
      },
      flow: {
        set: function () {
          try {
            node.context().flow.set.apply(node, arguments);
          } catch (err) {
            console.error("Error in flow.set:", err);
          }
        },
        get: function () {
          try {
            return node.context().flow.get.apply(node, arguments);
          } catch (err) {
            console.error("Error in flow.get:", err);
          }
        },
        keys: function () {
          try {
            return node.context().flow.keys.apply(node, arguments);
          } catch (err) {
            console.error("Error in flow.keys:", err);
          }
        },
      },
      global: {
        set: function () {
          try {
            node.context().global.set.apply(node, arguments);
          } catch (err) {
            console.error("Error in global.set:", err);
          }
        },
        get: function () {
          try {
            return node.context().global.get.apply(node, arguments);
          } catch (err) {
            console.error("Error in global.get:", err);
          }
        },
        keys: function () {
          try {
            return node.context().global.keys.apply(node, arguments);
          } catch (err) {
            console.error("Error in global.keys:", err);
          }
        },
      },
      env: {
        get: function (envVar) {
          try {
            return RED.util.getSetting(node, envVar);
          } catch (err) {
            console.error("Error in env.get:", err);
          }
        },
      },
      setTimeout: function () {
        const func = arguments[0];
        let timerId;
        arguments[0] = function () {
          try {
            sandBoxFunc()?.clearTimeout(timerId);
            func.apply(node, arguments);
          } catch (err) {
            node.error(err, {});
          }
        };
        try {
          timerId = setTimeout.apply(node, arguments);
          node.outstandingTimers.push(timerId);
          return timerId;
        } catch (err) {
          console.error("Error in setTimeout:", err);
        }
      },
      clearTimeout: function (id) {
        try {
          clearTimeout(id);
          const index = node.outstandingTimers.indexOf(id);
          if (index > -1) {
            node.outstandingTimers.splice(index, 1);
          }
        } catch (err) {
          console.error("Error in clearTimeout:", err);
        }
      },
      setInterval: function () {
        const func = arguments[0];
        let timerId;
        arguments[0] = function () {
          try {
            func.apply(node, arguments);
          } catch (err) {
            node.error(err, {});
          }
        };
        try {
          timerId = setInterval.apply(node, arguments);
          node.outstandingIntervals.push(timerId);
          return timerId;
        } catch (err) {
          console.error("Error in setInterval:", err);
        }
      },
      clearInterval: function (id) {
        try {
          clearInterval(id);
          const index = node.outstandingIntervals.indexOf(id);
          if (index > -1) {
            node.outstandingIntervals.splice(index, 1);
          }
        } catch (err) {
          console.error("Error in clearInterval:", err);
        }
      },
      runPython: async function (code, node, msg, send, done) {
        try {
          return await executePython(code, node, msg, send, done);
        } catch (err) {
          console.log("Error in python execution", err)
        }
      },
    };
  } catch (err) {
    console.error("Error in sandBoxFunc:", err);
  }
}

module.exports = { sandBoxFunc };
