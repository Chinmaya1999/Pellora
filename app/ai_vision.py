"""
Optional AI-vision second opinion (Claude). Turned on when ANTHROPIC_API_KEY is set
and the request asks for it (use_ai=true).

Why: pixel measurements are precise for colour/brightness/geometry, but weak at
judging things like firmness or moisture. A vision model looks at the whole face
the way a skin expert would. We blend both, per metric, which raises accuracy and
makes results steadier across different phones and lighting.
"""
from __future__ import annotations

import base64
import json
import os
import re

import cv2
import numpy as np

from .analyzer import LABELS, METRICS

MODEL = os.getenv("SKIN_AI_MODEL", "claude-sonnet-5-5")

# weight given to the AI score (rest = computer-vision score)
AI_WEIGHT = {
    "spots": 0.45, "pores": 0.5, "texture": 0.5, "redness": 0.35, "dark_circles": 0.4,
    "wrinkles": 0.5, "acne": 0.5, "oiliness": 0.45, "moisture": 0.7, "firmness": 0.7,
    "radiance": 0.55, "eye_bags": 0.6, "upper_eyelid_droopiness": 0.45,
    "lower_eyelid_droopiness": 0.5, "under_eye_hollows": 0.6,
}

PROMPT = """You are a cosmetic skin-analysis grader. Look at this face photo and grade each
skin concern on a 0-100 CONCERN scale (0 = none visible, 25 = mild, 50 = moderate,
75 = marked, 100 = severe). Grade only what is visible; this is cosmetic, not medical.
Be consistent and calibrated: most healthy adults score 10-40 on most items.

Concerns:
{items}

Our pixel measurements (concern 0-100) are given as hints; disagree when the photo
clearly shows otherwise:
{hints}

Reply with ONLY a JSON object: {{"<key>": <int>, ...}} using exactly these keys:
{keys}"""


def available() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _encode(img: np.ndarray) -> str:
    h, w = img.shape[:2]
    s = min(1.0, 1280 / max(h, w))
    if s < 1:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return base64.b64encode(buf.tobytes()).decode()


def grade(img: np.ndarray, cv_result: dict) -> dict[str, int] | None:
    import anthropic

    client = anthropic.Anthropic()
    keys = [k for k in METRICS if k in cv_result["metrics"]]  # only what this plan includes
    items = "\n".join(f"- {k}: {LABELS[k]}" for k in keys)
    hints = "\n".join(f"- {k}: {cv_result['metrics'][k]['concern']}" for k in keys)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": _encode(img)}},
            {"type": "text", "text": PROMPT.format(items=items, hints=hints, keys=", ".join(keys))},
        ]}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    data = json.loads(m.group(0))
    return {k: int(np.clip(float(data[k]), 0, 100)) for k in keys if k in data}


def blend(result: dict, ai: dict[str, int]) -> dict:
    from .analyzer import SkinAnalyzer

    for k, r in result["metrics"].items():
        if k not in ai:
            continue
        w = AI_WEIGHT[k]
        concern = (1 - w) * r["concern"] + w * ai[k]
        agree = 1 - abs(r["concern"] - ai[k]) / 100  # agreement boosts confidence
        r.update({
            "cv_concern": r["concern"], "ai_concern": ai[k],
            "concern": round(concern), "score": round(100 - concern),
            "level": SkinAnalyzer.level(concern), "rating": SkinAnalyzer.rating(100 - concern),
            "confidence": round(min(0.95, r["confidence"] + 0.15 * agree), 2),
        })
    scores = [r["score"] for r in result["metrics"].values()]
    result["overall_score"] = int(round(float(np.mean(scores))))
    result["engine"] = "cv+ai"
    return result
