"""Renders the homepage loop (content/outcomes.mp4) from scripts/outcomes/index.html, frame by frame.

Local only, never part of the build or CI. The animation is flat 2D on a canvas, a pure function of time
(index.html): the machine makes outcomes on a beat, I keep one, it floods the frame and becomes "idea", then
the machine starts again from it. 10 s at 60 fps, seamless. It renders in Chromium on the host's Playwright
server (see the global CLAUDE.md).

    uv run -q --with playwright==1.64.1 python -I scripts/outcomes/render.py sheet 1,3.2,4.7,7.4 /tmp/look.png
    uv run -q --with playwright==1.64.1 python -I scripts/outcomes/render.py frames 0 599 /tmp/outcomes
    ffmpeg -framerate 60 -i /tmp/outcomes/f%04d.png -c:v ffv1 /tmp/outcomes.mkv
    node media.mjs /tmp/outcomes.mkv outcomes.mp4 --poster 5.4 --sample

sheet: single times tiled into one image, to look at. frames: PNGs, skipping frames already there (resumable).
To watch it live, serve the repo root (python -m http.server) and open /scripts/outcomes/index.html.
"""
import base64
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FPS = 60


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main(args):
    if not args or args[0] not in ('sheet', 'frames') or len(args) < (3 if args[0] == 'sheet' else 4):
        sys.exit(__doc__)
    port = free_port()
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(ROOT)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.5)
    host = subprocess.run("ip route | awk '/^default/{print $3; exit}'", shell=True, capture_output=True, text=True).stdout.strip()
    try:
        with sync_playwright() as p:
            browser = p.chromium.connect(f'ws://{host}:3333/', expose_network='<loopback>')
            page = browser.new_page(viewport={'width': 800, 'height': 600})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/scripts/outcomes/index.html')
            page.wait_for_function('window.ready')
            frame = lambda t: base64.b64decode(page.evaluate('t => renderFrame(t)', t).split(',', 1)[1])
            if args[0] == 'sheet':
                times = [float(x) for x in args[1].split(',')]
                out = Path(args[2])
                tmp = out.parent / f'.{out.stem}'
                tmp.mkdir(exist_ok=True)
                for i, t in enumerate(times):
                    (tmp / f's{i:02d}.png').write_bytes(frame(t))
                cols = 4 if len(times) > 6 else 3 if len(times) > 4 else 2
                rows = -(-len(times) // cols)
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-i', str(tmp / 's%02d.png'),
                                '-vf', f'scale=640:-1,tile={cols}x{rows}:padding=6:color=black', '-frames:v', '1', str(out)], check=True)
            else:
                first, last, outdir = int(args[1]), int(args[2]), Path(args[3])
                outdir.mkdir(parents=True, exist_ok=True)
                for i in range(first, last + 1):
                    f = outdir / f'f{i:04d}.png'
                    if not f.exists():
                        f.write_bytes(frame(i / FPS))
            browser.close()
            if errors:
                sys.exit(f'page errors: {errors[:3]}')
    finally:
        server.terminate()


if __name__ == '__main__':
    main(sys.argv[1:])
