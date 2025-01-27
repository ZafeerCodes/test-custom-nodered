const executeCpp = require("./executors/cppExecutor");
const executeJavascript = require("./executors/javascriptExecutor");
const executeMojo = require("./executors/mojoExecutor");
const executePython = require("./executors/pythonExecutor");
const {
  sendResults,
  createVMOpt,
  updateErrorInfo,
} = require("./helpers/common");
const { handleExecutionError } = require("./helpers/errors");
const { sandBoxFunc } = require("./helpers/sandboxSetup");
const {
  getFunctionText,
  getInitText,
  getFinText,
} = require("./helpers/staticJs");
const { getPyFunctionText, getPyInitText } = require("./helpers/staticPy");

const exec = require("child_process").exec;

module.exports = function (RED) {
  "use strict";

  var util = require("util");
  var vm = require("vm");
  var acorn = require("acorn");
  var acornWalk = require("acorn-walk");

  function getFunctionMsgCode(lang, func) {
    if (lang === "javascript") {
      return getFunctionText(func);
    } else if (lang === "python") {
      return getPyFunctionText(func);
    } else {
      return getFunctionText(func);
    }
  }

  function getInitCode(lang, func) {
    if (lang === "javascript") {
      return getInitText(func);
    } else if (lang === "python") {
      return getPyInitText(func);
    } else {
      return getInitText(func);
    }
  }

  function getFinCode(lang, func) {
    if (lang === "javascript") {
      return getFinText(func);
    } else if (lang === "python") {
      return getPyFinText(func);
    } else {
      return getFinText(func);
    }
  }

  function multiLangNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.name = config.name;
    node.func = config.func;
    node.outputs = config.outputs;
    node.timeout = config.timeout * 1000;
    if (node.timeout > 0) {
      node.timeoutOptions = {
        timeout: node.timeout,
        breakOnSigint: true,
      };
    }
    node.ini = config.initialize ? config.initialize.trim() : "";
    node.fin = config.finalize ? config.finalize.trim() : "";
    node.libs = config.libs || [];

    var handleNodeDoneCall = true;

    var finScript = null;
    var finOpt = null;
    node.topic = config.topic;
    node.outstandingTimers = [];
    node.outstandingIntervals = [];
    node.clearStatus = false;
    const moduleLoadPromises = [];
    const RESOLVING = 0;
    const RESOLVED = 1;
    const ERROR = 2;
    var state = RESOLVING;
    var messages = [];
    var processMessage = () => {};

    var functionText = getFunctionMsgCode(config.selectedLang, node.func);
    var sandbox = sandBoxFunc(node, RED, util);

    if (
      RED.settings.functionExternalModules === false &&
      node.libs.length > 0
    ) {
      throw new Error("External Module Not Allowed");
    }

    if (/node\.done\s*\(\s*\)/.test(functionText)) {
      acornWalk.simple(acorn.parse(functionText, { ecmaVersion: "latest" }), {
        CallExpression(astNode) {
          if (astNode.callee && astNode.callee.object) {
            if (
              astNode.callee.object.name === "node" &&
              astNode.callee.property.name === "done"
            ) {
              handleNodeDoneCall = false;
            }
          }
        },
      });
    }

    if (util.hasOwnProperty("promisify")) {
      sandbox.setTimeout[util.promisify.custom] = function (after, value) {
        return new Promise(function (resolve, reject) {
          sandbox.setTimeout(function () {
            resolve(value);
          }, after);
        });
      };
      sandbox.promisify = util.promisify;
    }

    if (node.hasOwnProperty("libs")) {
      let moduleErrors = false;
      var modules = node.libs;
      modules.forEach((module) => {
        var vname = module.hasOwnProperty("var") ? module.var : null;
        if (vname && vname !== "") {
          if (sandbox.hasOwnProperty(vname) || vname === "node") {
            node.error(`Module Name Error ${vname}`);
            moduleErrors = true;
            return;
          }
          sandbox[vname] = null;
          var spec = module.module;
          if (spec && spec !== "") {
            moduleLoadPromises.push(
              RED.import(module.module)
                .then((lib) => {
                  sandbox[vname] = lib.default || lib;
                })
                .catch((err) => {
                  node.error(
                    `Module Load Error, module: ${module.spec},
                      error: ${err.toString()}`
                  );
                  throw err;
                })
            );
          }
        }
      });
      if (moduleErrors) {
        throw new Error("External Module Load Error");
      }
    }

    this.on("input", function (msg, send, done) {
      try {
        const { selectedLang } = config;
        if (state === RESOLVING) {
          messages.push({
            msg: msg,
            send: send,
            done: done,
            selectedLang: selectedLang,
          });
        } else if (state === RESOLVED) {
          processMessage(msg, send, done, selectedLang);
        }
      } catch (err) {
        console.log("Input Error: ", err);
      }
    });

    Promise.all(moduleLoadPromises)
      // Promise.resolve()
      .then(() => {
        var context = vm.createContext(sandbox);

        var promise = Promise.resolve();

        var iniScript = null;
        var iniOpt = null;
        if (node.ini && node.ini !== "") {
          const iniText = getInitCode(config.selectedLang, node.ini);
          iniOpt = createVMOpt(node, " setup");
          iniScript = new vm.Script(iniText, iniOpt);
          if (node.timeout > 0) {
            iniOpt.timeout = node.timeout;
            iniOpt.breakOnSigint = true;
          }
        }

        if (node.fin && node.fin !== "") {
          const finText = getFinCode(config.selectedLang, node.fin);
          finOpt = createVMOpt(node, " cleanup");
          finScript = new vm.Script(finText, finOpt);
          if (node.timeout > 0) {
            finOpt.timeout = node.timeout;
            finOpt.breakOnSigint = true;
          }
        }

        try {
          processMessage = function (msg, send, done, selectedLang) {
            var start = process.hrtime();
            context.msg = msg;
            context.__send__ = send;
            context.__done__ = done;
            context.__node__ = node;

            var opts = {};
            if (node.timeout > 0) {
              opts = node.timeoutOptions;
            }
            if (selectedLang === "javascript") {
              node.script = new vm.Script(functionText, createVMOpt(node, ""));
              try {
                if (iniScript) {
                  context.__initSend__ = function (msgs) {
                    node.send(msgs);
                  };
                  promise = iniScript.runInContext(context, iniOpt);
                }
                node.script.runInContext(context, opts);
                context.results
                  .then(function (results) {
                    sendResults(RED, node, send, msg._msgid, results, false);
                    if (handleNodeDoneCall) {
                      done();
                    }

                    var duration = process.hrtime(start);
                    var converted =
                      Math.floor((duration[0] * 1e9 + duration[1]) / 10000) /
                      100;
                    node.metric("duration", msg, converted);
                    if (process.env.NODE_RED_FUNCTION_TIME) {
                      node.status({
                        fill: "yellow",
                        shape: "dot",
                        text: "" + converted,
                      });
                    }
                  })
                  .catch((err) => {
                    handleExecutionError(err, msg, done);
                  });
              } catch (err) {
                handleExecutionError(err, msg, done);
              }
            } else if (selectedLang === "python") {
              (async () => {
                try {
                  node.script = new vm.Script(
                    `
                    (async function() {
                        const pythonCode = \`
                        ${functionText}
                        \`;
                
                        results = await runPython(pythonCode, ${JSON.stringify(
                          node
                        )}, ${JSON.stringify(msg)}, ${JSON.stringify(
                      send
                    )}, ${JSON.stringify(done)} )
                            .then(result => {
                                return result;
                            })
                            .catch(err => {
                                console.error('Execution Error:', err);
                                throw err;
                            });
                    })();
                    `,
                    createVMOpt(node, "")
                  );

                  if (iniScript) {
                    context.__initSend__ = function (msgs) {
                      node.send(msgs);
                    };
                    await iniScript.runInContext(context, iniOpt);
                  }
                  await node.script.runInContext(context, opts);
                  sendResults(RED, node, send, msg._msgid, context.results, false);
                } catch (err) {
                  console.error("Error executing script:", err);
                }
              })();
            }
            else if (selectedLang === "mojo") {
              executeMojo(config.func, node)
                .then((results) => {
                  sendResults(RED, node, send, msg._msgid, results, false);
                  done();
                })
                .catch((err) => {
                  console.error("Error executing Mojo:", err);
                  done(err);
                });
            } else if (selectedLang === "cpp") {
              executeCpp(config.func, node)
                .then((results) => {
                  sendResults(RED, node, send, msg._msgid, results, false);
                  done();
                })
                .catch((err) => {
                  console.error("Error executing C++:", err);
                  done(err);
                });
            }
          };

          promise
            .then(function (v) {
              var msgs = messages;
              messages = [];
              while (msgs.length > 0) {
                msgs.forEach(function (s) {
                  processMessage(s.msg, s.send, s.done, s.selectedLang);
                });
                msgs = messages;
                messages = [];
              }
              state = RESOLVED;
            })
            .catch((error) => {
              messages = [];
              state = ERROR;
              node.error(error);
            });

          node.on("close", function () {
            if (finScript) {
              try {
                finScript.runInContext(context, finOpt);
              } catch (err) {
                node.error(err);
              }
            }
            while (node.outstandingTimers.length > 0) {
              clearTimeout(node.outstandingTimers.pop());
            }
            while (node.outstandingIntervals.length > 0) {
              clearInterval(node.outstandingIntervals.pop());
            }
            if (node.clearStatus) {
              node.status({});
            }
          });
        } catch (err) {
          updateErrorInfo(err);
          node.error(err);
        }
      })
      .catch((err) => {
        node.error("Error: ", err);
      });
  }
  RED.nodes.registerType("multi languages", multiLangNode, {
    dynamicModuleList: "libs",
    settings: {
      functionExternalModules: { value: true, exportable: true },
      functionTimeout: { value: 0, exportable: true },
    },
  });
  RED.library.register("multiLanguages");
};
