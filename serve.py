#!/usr/bin/env python3
"""정적 사이트용 개발 서버 / 배포 준비 스크립트 (Python 표준 라이브러리만 사용).

    python3 serve.py            # http://localhost:5262 에서 개발 서버 실행
    python3 serve.py --build    # 배포 준비: 사이트 파일을 _site/ 에 복사하고 posts.json, 404.html 생성 (GitHub Actions 에서 실행)

GitHub Pages 는 폴더의 파일 목록을 알려 주지 않으므로 Posts/*.md 목록(posts.json)을 따로 만든다.
개발 서버는 이 목록을 요청마다 새로 만들고, 없는 주소에는 GitHub Pages 의 404.html 처럼
index.html 을 404 상태로 돌려주어 /post/... 같은 주소에서 새로고침해도 동작하게 한다.
"""

import argparse
import http.server
import json
import shutil
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_site"

# 배포되는 파일과 폴더. 그 밖의 파일(serve.py, CLAUDE.md 등)은 올라가지 않는다.
SITE = ["index.html", "icon-192.png", "games.json", "css", "js", "Posts"]


def post_index() -> bytes:
    slugs = sorted(path.stem for path in (ROOT / "Posts").glob("*.md"))
    return json.dumps(slugs, ensure_ascii=False, indent=2).encode("utf-8")


def build() -> None:
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir()
    for name in SITE:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, OUT / name)
        else:
            shutil.copy2(src, OUT / name)
    (OUT / "posts.json").write_bytes(post_index())
    shutil.copyfile(ROOT / "index.html", OUT / "404.html")
    print(f"wrote {OUT}")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        top = path.lstrip("/").split("/", 1)[0]
        if top and top != "posts.json" and top not in SITE:
            # 배포되지 않는 파일(serve.py, .git 등)은 로컬에서도 내주지 않는다.
            self.send_body(404, "text/html; charset=utf-8", (ROOT / "index.html").read_bytes())
        elif path == "/posts.json":
            self.send_body(200, "application/json; charset=utf-8", post_index())
        elif not Path(self.translate_path(self.path)).exists():
            self.send_body(404, "text/html; charset=utf-8", (ROOT / "index.html").read_bytes())
        else:
            super().do_GET()

    def send_body(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--build", action="store_true", help="_site/ 에 배포용 파일을 만들고 종료")
    parser.add_argument("--port", type=int, default=5262)
    args = parser.parse_args()

    if args.build:
        build()
        return

    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(ROOT)))
    print(f"http://localhost:{args.port}  (Ctrl+C 로 종료)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
