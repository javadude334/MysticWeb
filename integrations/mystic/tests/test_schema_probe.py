import importlib.machinery
import importlib.util
import json
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "native_schema_probe.mpy"
loader = importlib.machinery.SourceFileLoader("schema_probe", str(SOURCE))
spec = importlib.util.spec_from_loader(loader.name, loader)
probe = importlib.util.module_from_spec(spec)
loader.exec_module(probe)


class Secret:
    def __str__(self):
        raise AssertionError("secret must not be rendered")

    def __repr__(self):
        raise AssertionError("secret must not be rendered")


class NativeStub:
    def __init__(self):
        self.output = []
        self.calls = []

    def getuser(self, number):
        self.calls.append(("user", number))
        return {"id": 42, "flags": 0, "pwdata": Secret(), "password": Secret(),
                "handle": "SYNTHETIC_PRIVATE_HANDLE", "email": "SYNTHETIC_PRIVATE_EMAIL",
                "bad|PA": "SYNTHETIC_CONTROL"}

    def getmbase(self, number):
        self.calls.append(("area", number))
        return {"index": 1, "nettype": 1, "listacs": "SYNTHETIC_PRIVATE_ACS",
                "path": "SYNTHETIC_PRIVATE_PATH", "name": "SYNTHETIC_PRIVATE_AREA"}

    def getmgroup(self, number):
        self.calls.append(("group", number))
        return {"index": 1, "acs": "SYNTHETIC_GROUP_ACS", "name": "SYNTHETIC_GROUP_NAME"}

    def access(self, expression):
        self.calls.append(("acs", expression))
        return expression == "^"

    def writeln(self, text):
        self.output.append(text)


class ProbeTests(unittest.TestCase):
    def test_only_schema_and_types_are_reported(self):
        native = NativeStub()
        probe.run(native)
        text = "\n".join(native.output)
        self.assertNotIn("SYNTHETIC_", text)
        self.assertNotIn("bad|PA", text)
        report = json.loads(native.output[1])
        self.assertEqual(report["user"]["types"]["id"], "integer")
        self.assertEqual(report["first_area"]["types"]["listacs"], "string")
        self.assertNotIn("pwdata", report["user"]["types"])
        self.assertTrue(report["acs_always_true"])
        self.assertTrue(report["acs_always_false"])
        self.assertEqual(native.calls, [("user", 0), ("area", 0), ("group", 0), ("acs", "^"), ("acs", "%")])

    def test_native_exceptions_are_not_printed(self):
        native = NativeStub()
        def fail(_):
            raise RuntimeError("SYNTHETIC_SECRET_EXCEPTION_PATH")
        native.getuser = fail
        probe.run(native)
        self.assertNotIn("SYNTHETIC_", "\n".join(native.output))
        self.assertEqual(json.loads(native.output[1])["error"], "unavailable")

    def test_absent_user_and_unsupported_schema_deny(self):
        native = NativeStub()
        native.getuser = lambda _: None
        probe.run(native)
        self.assertIn('"error":"unavailable"', native.output[1])
        with self.assertRaises(ValueError):
            probe.schema([])
        with self.assertRaises(ValueError):
            probe.schema(dict(("field%s" % i, i) for i in range(129)))


if __name__ == "__main__":
    unittest.main()
