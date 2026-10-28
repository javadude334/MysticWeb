"""Private mTLS bridge endpoint, Python 3.10+. No automatic driver loading.

An operator-owned entrypoint calls serve with an explicit trusted driver and
certificate paths. Never run this in the obsolete Python 2.7 native engine.
"""
import ipaddress
import json
import re
import ssl
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from bridge_core import BridgeDispatcher


def make_server(address, context, instance, driver=None):
    # Refuse to bind a listener until an explicit runtime composition exists.
    # Structural validation is not native certification or worker isolation.
    if driver is None or any(not callable(getattr(driver, name, None)) for name in
                             ['resolve', 'account', 'verify_password', 'authorize']):
        raise ValueError('Bridge unavailable')
    if (context.verify_mode != ssl.CERT_REQUIRED or
            context.minimum_version < ssl.TLSVersion.TLSv1_2 or
            not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', instance)):
        raise ValueError('Bridge unavailable')
    host, port = address
    ip = ipaddress.ip_address(host)
    if not (ip.is_private or ip.is_loopback) or ip.is_unspecified or not 1 <= port <= 65535:
        raise ValueError('Bridge unavailable')
    dispatcher = BridgeDispatcher(instance, driver)

    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.0'

        def log_message(self, *args):
            pass

        def log_error(self, *args):
            pass

        def send_error(self, code, message=None, explain=None):
            self.reply(400, {'error': 'Access unavailable'})

        def reply(self, status, value):
            body = json.dumps(value, separators=(',', ':')).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(body)
            self.close_connection = True

        def do_POST(self):
            try:
                lengths = self.headers.get_all('Content-Length', [])
                if (self.path != '/v1/native' or len(lengths) != 1 or
                        not re.fullmatch(r'[1-9][0-9]{0,3}', lengths[0]) or
                        int(lengths[0]) > 4096 or
                        self.headers.get_all('Content-Type') != ['application/json'] or
                        self.headers.get('Transfer-Encoding') is not None or
                        self.headers.get('Content-Encoding') is not None):
                    self.reply(400, {'error': 'Access unavailable'})
                    return
                raw = self.rfile.read(int(lengths[0]))
                if len(raw) != int(lengths[0]):
                    raise ValueError()
                result = dispatcher.dispatch(raw)
                self.reply(403 if 'error' in result else 200, result)
            except Exception:
                self.close_connection = True

    class Server(HTTPServer):
        # Single bounded worker: native context cannot execute concurrently.
        request_queue_size = 8

        def process_request(self, request, client_address):
            def expire():
                try:
                    request.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                request.close()
            timer = threading.Timer(1.5, expire)
            timer.daemon = True
            timer.start()
            try:
                super().process_request(request, client_address)
            finally:
                timer.cancel()

        def get_request(self):
            sock, peer = super().get_request()
            sock.settimeout(1.5)
            try:
                return context.wrap_socket(sock, server_side=True), peer
            except Exception:
                sock.close()
                raise

        def handle_error(self, request, client_address):
            pass  # No exception/credential capture.

    return Server(address, Handler)


def serve(address, instance, ca, cert, key, driver=None):
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.verify_mode = ssl.CERT_REQUIRED
    context.load_verify_locations(cafile=ca)
    context.load_cert_chain(certfile=cert, keyfile=key)
    with make_server(address, context, instance, driver) as server:
        server.serve_forever()
