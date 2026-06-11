import http.server
import socketserver
import os
import sys
from pathlib import Path

def serve_static_files():
    """Serve the static files using Python's built-in HTTP server"""
    PORT = 5000
    STATIC_DIR = Path("shadowide-website/out")

    if not STATIC_DIR.exists():
        print(f"Error: Static directory {STATIC_DIR} not found!")
        print("Please make sure you've built the Next.js application first.")
        sys.exit(1)

    os.chdir(STATIC_DIR)
    
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.extensions_map.update({
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
    })

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    serve_static_files()