"""Execute app and Sheets regression suites using macOS JavaScriptCore."""
import ctypes
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class JavaScript:
    def __init__(self):
        self.lib = ctypes.CDLL('/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore')
        pointer = ctypes.c_void_p
        signatures = {
            'JSGlobalContextCreate': ([pointer], pointer),
            'JSGlobalContextRelease': ([pointer], None),
            'JSStringCreateWithUTF8CString': ([ctypes.c_char_p], pointer),
            'JSStringRelease': ([pointer], None),
            'JSEvaluateScript': ([pointer,pointer,pointer,pointer,ctypes.c_int,ctypes.POINTER(pointer)],pointer),
            'JSValueToStringCopy': ([pointer,pointer,ctypes.POINTER(pointer)],pointer),
            'JSStringGetMaximumUTF8CStringSize': ([pointer],ctypes.c_size_t),
            'JSStringGetUTF8CString': ([pointer,ctypes.c_char_p,ctypes.c_size_t],ctypes.c_size_t),
        }
        for name, (args, result) in signatures.items():
            getattr(self.lib,name).argtypes=args
            getattr(self.lib,name).restype=result
        self.ctx=self.lib.JSGlobalContextCreate(None)

    def text(self, value):
        string=self.lib.JSValueToStringCopy(self.ctx,value,None)
        try:
            size=self.lib.JSStringGetMaximumUTF8CStringSize(string)
            output=ctypes.create_string_buffer(size)
            self.lib.JSStringGetUTF8CString(string,output,size)
            return output.value.decode()
        finally:
            self.lib.JSStringRelease(string)

    def evaluate(self, source):
        string=self.lib.JSStringCreateWithUTF8CString(source.encode())
        error=ctypes.c_void_p()
        try:
            result=self.lib.JSEvaluateScript(self.ctx,string,None,None,1,ctypes.byref(error))
            if error.value:
                raise AssertionError(self.text(error))
            return self.text(result)
        finally:
            self.lib.JSStringRelease(string)

    def close(self):
        self.lib.JSGlobalContextRelease(self.ctx)


@unittest.skipUnless(sys.platform=='darwin', 'Requires the macOS JavaScriptCore framework; harness files are plain JavaScript')
class JavaScriptTests(unittest.TestCase):
    def setUp(self):
        self.js=JavaScript()
        self.addCleanup(self.js.close)

    def test_frontend_requirements_and_events(self):
        for file in ('test/frontend-harness.js','src/js/app.js','test/frontend-checks.js'):
            self.js.evaluate((ROOT/file).read_text())
        result=json.loads(self.js.evaluate('JSON.stringify(testResult)'))
        self.assertTrue(result['ok'], result.get('error'))
        self.assertGreaterEqual(result['assertions'],40)
        print('Frontend behaviour assertions:',result['assertions'])

    def test_apps_script_storage_and_http(self):
        for file in ('test/sheets-harness.js','integrations/google-sheets/Code.gs','test/sheets-checks.js'):
            self.js.evaluate((ROOT/file).read_text())
        count=int(self.js.evaluate('checks'))
        self.assertGreaterEqual(count,30)
        print('Apps Script storage assertions:',count)


@unittest.skipUnless(sys.platform=='darwin', 'Requires macOS JavaScriptCore; native Node test also provided')
class WorkerJavaScriptTests(unittest.TestCase):
    def test_worker_routes_and_storage_contract(self):
        js=JavaScript()
        self.addCleanup(js.close)
        js.evaluate((ROOT/'test/worker-harness.js').read_text())
        source=(ROOT/'cloudflare/worker.mjs').read_text().replace('export function ','function ').replace('export default {','var worker = {')
        js.evaluate(source)
        js.evaluate((ROOT/'test/worker-checks.js').read_text())
        js.evaluate("var workerResult;runWorkerChecks(worker,validatePost,indiaToday).then(count=>workerResult={ok:true,count}).catch(error=>workerResult={ok:false,error:String(error)+' '+String(error.stack)});")
        result=json.loads(js.evaluate('JSON.stringify(workerResult)'))
        self.assertTrue(result['ok'],result.get('error'))
        self.assertGreater(result['count'],100)
        print('Cloudflare Worker assertions (simulated Web APIs/D1):',result['count'])
