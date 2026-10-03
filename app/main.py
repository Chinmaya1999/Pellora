"""
Skin Analysis API (FastAPI)

  POST /v1/analyze     multipart: image=<file>  [use_ai=true] [overlay=true]
  GET  /health
  GET  /               demo page (camera scan)

Auth: set SKIN_API_KEYS="key1,key2" and send header  X-API-Key: key1
      (if SKIN_API_KEYS is empty, the API is open - dev mode only)
"""
from __future__ import annotations

import base64
import logging
import os
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from . import ai_vision
from .analyzer import AnalysisError, SkinAnalyzer

log = logging.getLogger("skin-api")
app = FastAPI(title="Skin Analysis API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

analyzer = SkinAnalyzer()
API_KEYS = {k.strip() for k in os.getenv("SKIN_API_KEYS", "").split(",") if k.strip()}
MAX_BYTES = 10 * 1024 * 1024
STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")

DISCLAIMER = ("Cosmetic skin assessment from a photo. Not a medical diagnosis. "
              "See a dermatologist for medical concerns.")


def _auth(key: str | None):
    if API_KEYS and key not in API_KEYS:
        raise HTTPException(401, "Invalid or missing X-API-Key")


@app.get("/health")
def health():
    return {"status": "ok", "ai_available": ai_vision.available()}


@app.get("/")
def demo():
    return FileResponse(os.path.join(STATIC, "index.html"))


@app.post("/v1/check")
async def check(image: UploadFile = File(...), x_api_key: str | None = Header(None)):
    """Cheap per-frame framing check used by the demo page for auto-capture."""
    _auth(x_api_key)
    img = cv2.imdecode(np.frombuffer(await image.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Unsupported image.")
    return await run_in_threadpool(analyzer.check, img)


@app.post("/v1/analyze")
async def analyze(
    image: UploadFile = File(...),
    use_ai: bool = Form(False),
    overlay: bool = Form(False),
    overlays: bool = Form(True),   # per-metric mask images are returned unless overlays=false
    x_api_key: str | None = Header(None),
):
    _auth(x_api_key)
    data = await image.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image larger than 10 MB")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Unsupported image. Send JPG, PNG or WEBP.")

    t0 = time.time()
    try:
        result = await run_in_threadpool(analyzer.analyze, img, overlay, overlays)
    except AnalysisError as e:
        return JSONResponse(status_code=422, content={"error": e.code, "message": e.message})
    result["engine"] = "cv"

    if use_ai and ai_vision.available():
        try:
            ai = await run_in_threadpool(ai_vision.grade, img, result)
            if ai:
                result = ai_vision.blend(result, ai)
        except Exception as e:  # AI is a bonus; never fail the scan because of it
            log.warning("AI grading failed: %s", e)
            result["ai_error"] = "AI second opinion unavailable; returned CV-only result."

    if overlay and "_overlay" in result:
        ok, buf = cv2.imencode(".jpg", result.pop("_overlay"), [cv2.IMWRITE_JPEG_QUALITY, 85])
        result["overlay_jpeg_base64"] = base64.b64encode(buf.tobytes()).decode()
    result.pop("_overlay", None)
    result["processing_ms"] = int((time.time() - t0) * 1000)
    result["disclaimer"] = DISCLAIMER
    return result
