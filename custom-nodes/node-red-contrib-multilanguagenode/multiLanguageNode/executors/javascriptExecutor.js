const vm = require('vm');

function executeJavascript(code, msg, sandbox, node, send, done) {
    const script = new vm.Script(code);
    try {
        const result = script.runInContext(vm.createContext(sandbox));
        msg.payload = result;
        send(msg);
        done();
    } catch (err) {
        node.error(`JavaScript error: ${err.stack}`, msg);
        done(err);
    }
}

module.exports = executeJavascript;
