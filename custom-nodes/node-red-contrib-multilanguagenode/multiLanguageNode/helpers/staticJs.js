function getFunctionText(func) {
  var functionText =
    "var results = null;" +
    "results = (async function(msg,__send__,__done__){ " +
    "var __msgid__ = msg._msgid;" +
    "var node = {" +
    "id:__node__.id," +
    "name:__node__.name," +
    "path:__node__.path," +
    "outputCount:__node__.outputCount," +
    "log:__node__.log," +
    "error:__node__.error," +
    "warn:__node__.warn," +
    "debug:__node__.debug," +
    "trace:__node__.trace," +
    "on:__node__.on," +
    "status:__node__.status," +
    "send:function(msgs,cloneMsg){ __node__.send(__send__,__msgid__,msgs,cloneMsg);}," +
    "done:__done__" +
    "};\n" +
    func +
    "\n" +
    "})(msg,__send__,__done__);";

  return functionText;
}

function getInitText(ini) {
  const iniText = `
        (async (__send__) => {
          const node = {
            id: __node__.id,
            name: __node__.name,
            path: __node__.path,
            outputCount: __node__.outputCount,
            log: __node__.log,
            error: __node__.error,
            warn: __node__.warn,
            debug: __node__.debug,
            trace: __node__.trace,
            status: __node__.status,
            send: (msgs, cloneMsg) => {
              __node__.send(__send__, RED.util.generateId(), msgs, cloneMsg);
            }
          };
          ${ini}
        })(__initSend__);
      `;

  return iniText;
}

function getFinText(fin) {
  const finText = `
  (() => {
    const node = {
      id: __node__.id,
      name: __node__.name,
      path: __node__.path,
      outputCount: __node__.outputCount,
      log: __node__.log,
      error: __node__.error,
      warn: __node__.warn,
      debug: __node__.debug,
      trace: __node__.trace,
      status: __node__.status,
      send: (msgs, cloneMsg) => {
        __node__.error("Cannot send from close function");
      }
    };
    ${fin}
  })();
`;
  return finText;
}

module.exports = { getFunctionText, getInitText, getFinText };
