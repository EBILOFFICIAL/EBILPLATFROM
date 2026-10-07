"""Thin launcher: starts the Node.js/Express EIBIL API (and Redis if available) and forwards /api traffic to it."""
import asyncio
import os
import shutil
import subprocess
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response

ROOT = Path(__file__).parent
NODE_PORT = 8002
TARGET = f"http://127.0.0.1:{NODE_PORT}"
HOP = {"host", "content-length", "connection", "keep-alive", "transfer-encoding", "upgrade"}

app = FastAPI()
client = httpx.AsyncClient(base_url=TARGET, timeout=120)
procs = {}


def ensure_redis():
    if not shutil.which("redis-server"):
        return
    if subprocess.run(["redis-cli", "ping"], capture_output=True, text=True).stdout.strip() == "PONG":
        return
    procs["redis"] = subprocess.Popen(["redis-server", "--port", "6379", "--save", "", "--daemonize", "no"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


@app.on_event("startup")
async def start_node():
    ensure_redis()
    subprocess.run(["pkill", "-f", "node src/server.js"], capture_output=True)
    env = {**os.environ, "NODE_PORT": str(NODE_PORT)}
    procs["node"] = subprocess.Popen(["node", "src/server.js"], cwd=ROOT, env=env)
    for _ in range(60):
        try:
            await client.get("/api/v1/health")
            return
        except httpx.HTTPError:
            await asyncio.sleep(0.5)


@app.on_event("shutdown")
async def stop_node():
    for p in procs.values():
        p.terminate()


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    headers["x-forwarded-for"] = request.headers.get("x-forwarded-for", request.client.host if request.client else "")
    upstream = await client.request(request.method, f"/api/{path}", params=request.query_params, content=await request.body(), headers=headers)
    out = Response(content=upstream.content, status_code=upstream.status_code)
    for k, v in upstream.headers.multi_items():
        if k.lower() not in HOP and k.lower() != "content-encoding":
            out.headers.append(k, v)
    return out
