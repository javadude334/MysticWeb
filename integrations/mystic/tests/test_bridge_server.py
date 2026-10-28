import os
import ssl
import sys
import unittest
import http.client
import json
import shutil
import subprocess
import tempfile
import threading
import test_bridge_core as fixtures
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bridge_server import make_server
from test_a48_native_verifier import Native, synthetic_driver


class ServerTests(unittest.TestCase):
    def test_mtls_http_and_protocol_denial(self):
        openssl = shutil.which('openssl')
        if not openssl and os.path.exists('C:/Program Files/Git/usr/bin/openssl.exe'):
            openssl = 'C:/Program Files/Git/usr/bin/openssl.exe'
        with tempfile.TemporaryDirectory() as directory:
            cert, key = [os.path.join(directory, name) for name in ['cert.pem', 'key.pem']]
            if openssl:
                subprocess.run([openssl, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                                '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost',
                                '-addext', 'subjectAltName=DNS:localhost'],
                               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                # Bundled Windows runtime has cryptography; CI uses OpenSSL.
                try:
                    from cryptography import x509
                    from cryptography.hazmat.primitives import hashes, serialization
                    from cryptography.hazmat.primitives.asymmetric import rsa
                    from cryptography.x509.oid import NameOID
                    import datetime
                except ImportError:
                    self.skipTest('OpenSSL or cryptography required for temporary test certificates')
                private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
                name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
                now = datetime.datetime.now(datetime.timezone.utc)
                certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
                               .public_key(private.public_key()).serial_number(x509.random_serial_number())
                               .not_valid_before(now - datetime.timedelta(minutes=1))
                               .not_valid_after(now + datetime.timedelta(days=1))
                               .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
                               .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]), critical=False)
                               .sign(private, hashes.SHA256()))
                with open(cert, 'wb') as output:
                    output.write(certificate.public_bytes(serialization.Encoding.PEM))
                with open(key, 'wb') as output:
                    output.write(private.private_bytes(serialization.Encoding.PEM,
                                 serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.verify_mode = ssl.CERT_REQUIRED
            context.load_cert_chain(cert, key)
            context.load_verify_locations(cert)
            # Bind an ephemeral port ourselves because deployment rejects port 0.
            import socket
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', 0))
                port = probe.getsockname()[1]
            driver = synthetic_driver(Native())
            server = make_server(('127.0.0.1', port), context, 'vm', driver)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            def call(client, body, headers=None, path='/v1/native'):
                connection = http.client.HTTPSConnection('localhost', port, context=client, timeout=3)
                try:
                    connection.request('POST', path, body, headers or {'Content-Type': 'application/json'})
                    response = connection.getresponse()
                    return response.status, json.loads(response.read())
                finally:
                    connection.close()
            try:
                client = ssl.create_default_context(cafile=cert)
                with self.assertRaises((ssl.SSLError, OSError)):
                    call(client, fixtures.BridgeTests().request())
                untrusted = ssl.create_default_context()
                untrusted.load_cert_chain(cert, key)
                with self.assertRaises((ssl.SSLError, OSError)):
                    call(untrusted, fixtures.BridgeTests().request())
                client.load_cert_chain(cert, key)
                raw = fixtures.BridgeTests().request(username='B', password='synthetic-B')
                status, reply = call(client, raw)
                self.assertEqual(status, 200)
                self.assertTrue(reply['passwordVerified'])
                self.assertEqual(reply['userId'], 73)
                self.assertEqual(call(client, raw)[0], 403)  # replay
                crossed = fixtures.BridgeTests().request(nonce='C' * 43, username='B', password='synthetic-A')
                self.assertEqual(call(client, crossed), (403, {'error': 'Access unavailable'}))
                driver.policy.allowed = False
                denied = fixtures.BridgeTests().request('authorize', nonce='D' * 43,
                         userId=73, areaId=1, catalogRevision='a' * 64)
                self.assertEqual(call(client, denied), (403, {'error': 'Access unavailable'}))
                self.assertEqual(call(client, b'X' * 4097)[0], 400)
                self.assertEqual(call(client, raw, path='/wrong')[0], 400)
                self.assertEqual(call(client, b'{')[0], 403)
            finally:
                server.shutdown()
                server.server_close()
                worker.join(3)

    def test_insecure_tls_and_public_bind_rejected(self):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        with self.assertRaises(ValueError):
            make_server(('127.0.0.1', 8443), context, 'vm', fixtures.Driver())
        context.verify_mode = ssl.CERT_REQUIRED
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        for host in ['0.0.0.0', '8.8.8.8']:
            with self.assertRaises(ValueError):
                make_server((host, 8443), context, 'vm', fixtures.Driver())
        with self.assertRaises(ValueError):
            make_server(('127.0.0.1', 8443), context, '../bad', fixtures.Driver())

    def test_missing_runtime_binding_rejected_before_socket_creation(self):
        from unittest.mock import patch
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.verify_mode = ssl.CERT_REQUIRED
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        for driver in [None, object(), type('Partial', (), {'resolve': lambda *args: 42})()]:
            with patch('bridge_server.HTTPServer.__init__') as bind:
                with self.assertRaises(ValueError):
                    make_server(('127.0.0.1', 8443), context, 'vm', driver)
                bind.assert_not_called()
