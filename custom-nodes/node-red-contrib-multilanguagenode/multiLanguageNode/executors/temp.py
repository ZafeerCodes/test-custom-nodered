msg = {"_msgid":"ddfcb196c994806d","payload":1733021955853,"topic":""}
__node__ = {"id":"f0bbe1fdcc338b79","type":"multi languages","z":"c0679c9896d78f59","_closeCallbacks":["None"],"_inputCallbacks":"None","_expectedDoneCount":1,"name":"multi languages 2","wires":[["e2d4c604150f20b0"]],"_wireCount":1,"_wire":"e2d4c604150f20b0","func":"return msg","outputs":1,"timeout":0,"ini":"","fin":"","libs":[],"outstandingTimers":[],"outstandingIntervals":[],"clearStatus":"False"}
__send__ = None
__done__ = None

                        
import asyncio
import json
import textwrap

results = None
async def inner_function(msg, __send__, __done__, __node__):
    __msgid__ = msg.get('_msgid', None)
    node = {
        'id': __node__.get('id', None) if '__node__' in globals() else None,
        'name': __node__.get('name', None) if '__node__' in globals() else None,
        'path': __node__.get('path', None) if '__node__' in globals() else None,
        'outputCount': __node__.get('outputCount', None) if '__node__' in globals() else None,
        'log': __node__.get('log', print) if '__node__' in globals() else print,
        'error': __node__.get('error', print) if '__node__' in globals() else print,
        'warn': __node__.get('warn', print) if '__node__' in globals() else print,
        'debug': __node__.get('debug', print) if '__node__' in globals() else print,
        'trace': __node__.get('trace', print) if '__node__' in globals() else print,
        'on': __node__.get('on', None) if '__node__' in globals() else None,
        'status': __node__.get('status', None) if '__node__' in globals() else None,
        'send': lambda msgs, clone_msg=None: __node__.get('send', lambda *args: None)(__send__, __msgid__, msgs, clone_msg) if '__node__' in globals() else lambda *args: None,
        'done': __done__
    }

    user_code = '''
return msg'''
    user_code_indented = textwrap.indent(user_code, '    ')
    func_code = f"""
def execute_main(msg):
    {user_code_indented}
"""

    local_namespace = {}
    try:
        exec(func_code, globals(), local_namespace)
        if 'execute_main' in local_namespace:
            return_value = local_namespace['execute_main'](msg)
        else:
            raise ValueError("No 'execute_main' function defined in the provided code.")
    except Exception as e:
        return {"error": str(e)}

    return return_value

import asyncio
try:
    results = asyncio.run(inner_function(msg, __send__, __done__, __node__))
    if 'error' in results:
        print(json.dumps(results)) 
    else:
        print(json.dumps({'type': 'main', 'results': results}))
except Exception as e:
    print(json.dumps({"error": str(e)})) 

                        
