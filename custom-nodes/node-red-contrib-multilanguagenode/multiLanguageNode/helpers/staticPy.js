function getPyFunctionText(func) {
  var functionText =
    "\nimport asyncio" +
    "\nimport json" +
    "\nimport textwrap" + 
    "\n\nresults = None\n" +
    "async def inner_function(msg, __send__, __done__, __node__):\n" +
    "    __msgid__ = msg.get('_msgid', None)\n" +
    "    node = {\n" +
    "        'id': __node__.get('id', None) if '__node__' in globals() else None,\n" +
    "        'name': __node__.get('name', None) if '__node__' in globals() else None,\n" +
    "        'path': __node__.get('path', None) if '__node__' in globals() else None,\n" +
    "        'outputCount': __node__.get('outputCount', None) if '__node__' in globals() else None,\n" +
    "        'log': __node__.get('log', print) if '__node__' in globals() else print,\n" +
    "        'error': __node__.get('error', print) if '__node__' in globals() else print,\n" +
    "        'warn': __node__.get('warn', print) if '__node__' in globals() else print,\n" +
    "        'debug': __node__.get('debug', print) if '__node__' in globals() else print,\n" +
    "        'trace': __node__.get('trace', print) if '__node__' in globals() else print,\n" +
    "        'on': __node__.get('on', None) if '__node__' in globals() else None,\n" +
    "        'status': __node__.get('status', None) if '__node__' in globals() else None,\n" +
    "        'send': lambda msgs, clone_msg=None: __node__.get('send', lambda *args: None)(__send__, __msgid__, msgs, clone_msg) if '__node__' in globals() else lambda *args: None,\n" +
    "        'done': __done__\n" +
    "    }\n\n" +
    "    user_code = '''\n" + func + "'''\n" +
    "    user_code_indented = textwrap.indent(user_code, '    ')\n" +
    "    func_code = f\"\"\"\n" +
    "def execute_main(msg):\n" +
    "    {user_code_indented}\n" +
    "\"\"\"\n\n" +
    "    local_namespace = {}\n" +
    "    try:\n" +
    "        exec(func_code, globals(), local_namespace)\n" +
    "        if 'execute_main' in local_namespace:\n" +
    "            return_value = local_namespace['execute_main'](msg)\n" +
    "        else:\n" +
    "            raise ValueError(\"No 'execute_main' function defined in the provided code.\")\n" +
    "    except Exception as e:\n" +
    "        return {\"error\": str(e)}\n\n" +  
    "    return return_value\n\n" +
    "import asyncio\n" +
    "try:\n" +
    "    results = asyncio.run(inner_function(msg, __send__, __done__, __node__))\n" +
    "    if 'error' in results:\n" +   
    "        print(json.dumps(results)) \n" +
    "    else:\n" +
    "        print(json.dumps({'type': 'main', 'results': results}))\n" +
    "except Exception as e:\n" +
    "    print(json.dumps({\"error\": str(e)})) \n";

  return functionText;
}


function getPyInitText(ini) {
  const iniText = `
        async def inner_function(__send__):
            node = {
                'id': __node__['id'],
                'name': __node__['name'],
                'path': __node__['path'],
                'outputCount': __node__['outputCount'],
                'log': __node__['log'],
                'error': __node__['error'],
                'warn': __node__['warn'],
                'debug': __node__['debug'],
                'trace': __node__['trace'],
                'status': __node__['status'],
                'send': lambda msgs, clone_msg: __node__['send'](__send__, RED.util.generateId(), msgs, clone_msg)
            }
            ${ini}

        await inner_function(__initSend__)
      `;

  return iniText;
}

function getPyFinText(fin) {
  const finText = `
  async def inner_function():
      node = {
          'id': __node__['id'],
          'name': __node__['name'],
          'path': __node__['path'],
          'outputCount': __node__['outputCount'],
          'log': __node__['log'],
          'error': __node__['error'],
          'warn': __node__['warn'],
          'debug': __node__['debug'],
          'trace': __node__['trace'],
          'status': __node__['status'],
          'send': lambda msgs, clone_msg: __node__['error']("Cannot send from close function")
      }
      ${fin}
  
  await inner_function()
`;
  return finText;
}

module.exports = { getPyFunctionText, getPyInitText, getPyFinText };
