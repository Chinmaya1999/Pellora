# Skin Analysis API

You send one face photo and get back 15 skin scores, each from 0 to 100 (100 means excellent):

Spots · Pores · Texture · Redness · Dark Circles · Wrinkles · Acne · Oiliness · Moisture ·
Firmness · Radiance · Eye Bags · Upper Eyelid Droopiness · Lower Eyelid Droopiness · Under-Eye Hollows

## 1. Run it

**Option A: Python 3.10 or newer**
```bash
./download_models.sh        # one time: downloads the 56 MB face-landmark model
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
**Option B: Docker (for a server)**
```bash
docker build -t skin-api .
docker run -p 8000:8000 -e SKIN_API_KEYS=your-secret-key skin-api
```
Then open http://localhost:8000 to try the camera scan page.

## 2. Settings (environment variables)

| Variable | What it does |
|---|---|
| `SKIN_API_KEYS` | Comma-separated API keys. Callers send `X-API-Key: <key>`. **Always set this in production.** |
| `ANTHROPIC_API_KEY` | Turns on the optional AI second opinion (`use_ai=true`) |
| `SKIN_AI_MODEL` | AI model to use (default `claude-sonnet-5-5`) |
| `CORS_ORIGINS` | e.g. `https://bluesatchel.online` (default `*`) |

## 3. Call it

```bash
curl -X POST https://your-server/v1/analyze \
  -H "X-API-Key: your-secret-key" \
  -F image=@face.jpg \
  -F use_ai=true
```

Here is part of a response:
```json
{
  "overall_score": 71,
  "engine": "cv+ai",
  "metrics": {
    "spots":    {"label":"Spots","score":72,"concern":28,"level":"mild","confidence":0.68,"raw":9.26},
    "wrinkles": {"label":"Wrinkles","score":83,"concern":17,"level":"none","confidence":0.7, "raw":3.66},
    "...": "15 metrics in total"
  },
  "quality": {"score":92,"issues":[],"face_size_px":310,"sharpness":220,"brightness":150},
  "processing_ms": 190,
  "disclaimer": "Cosmetic skin assessment from a photo. Not a medical diagnosis..."
}
```
- `score` runs 0 to 100, and higher is better. `concern` equals 100 minus `score`.
- `level` is one of `none`, `mild`, `moderate` or `severe`.
- `confidence` runs 0 to 1 and tells you how much to trust that metric for this particular photo.
- Bad photos come back as HTTP 422, for example `{"error":"too_dark","message":"..."}`. Show the `message` to the user so they can retake the photo. The possible codes are `no_face`, `face_too_small`, `too_dark`, `face_turned` and `eyes_closed`.
- Every metric also returns `overlay_jpeg_base64`: your photo with that metric's mask drawn on it (15 images). Send `-F overlays=false` for scores only. `-F overlay=true` adds one extra image with all analysis zones.

## 4. How it works

1. **Face and landmarks:** YuNet finds the face and LBF places 68 points on it. The face is then straightened and scaled to a fixed size.
2. **Photo quality gate:** the photo is checked for size, blur, light, even lighting, head turn, closed eyes and expression. Poor photos are rejected, or their confidence is lowered.
3. **Measurements per zone:** each concern is measured in its own zone (forehead, cheeks, nose, chin, under-eye, tear trough, crow's feet, eyelids and smile lines).
   - Spots and pores are found as dark blobs of different sizes.
   - Redness and acne come from the red channel in LAB colour.
   - Wrinkles are line detection (ridge filter).
   - Oiliness is shine and highlights.
   - Eyelid scores come from eye geometry.
   - Dark circles, bags and hollows come from shadow profiles under the eye.
4. **Calibration:** `calibration.json` turns each raw measurement into a 0 to 100 score.
5. **AI second opinion (optional):** a vision model grades the photo, and its grade is blended with the measurements for each metric. It gets more weight for metrics that photos show poorly, such as moisture and firmness.

## 5. Accuracy: reaching 50% to 90%

No one can promise an accuracy number for skin scoring until it has been measured against expert grades on real photos. This package includes the tool that measures it and tunes the scores for you:

```bash
python tools/calibrate.py labels.csv          # shows accuracy per metric
python tools/calibrate.py labels.csv --fit    # tunes calibration.json to your experts
```
In this tool, **accuracy** means the percentage of scores that land within ±15 points of a dermatologist's grade. That is roughly how far apart two human experts usually are.

| Metric group | Without calibration (expected) | After calibration and AI blend (realistic target) |
|---|---|---|
| Redness, spots, dark circles, acne, oiliness | 55–70% | **75–90%** |
| Wrinkles, texture, pores, radiance, eyelids | 50–65% | **70–85%** |
| Moisture, firmness, eye bags, hollows (2D photos can't show these well) | 40–55% | **60–75%** |

**What raises accuracy, from biggest effect to smallest:**
1. **Consistent photos.** Use a front-facing face in daylight, with no makeup, no beauty filter and a neutral face. The scan page shows an oval guide for this, and the quality gate enforces it.
2. **Calibrating with your own labelled photos.** Get 150 to 300 photos covering different ages and skin tones (Indian skin tones especially, if that is your market) and have them graded by a dermatologist.
3. **Turning on `use_ai=true`.** This helps most for moisture, firmness and eye bags.
4. **Close-up, high-resolution photos.** Pores and fine texture need the face to fill the frame.

## 6. Important for going live

- **Consent and privacy.** Face photos are personal data. Get users' consent, state in your privacy policy how long photos are kept, and comply with India's DPDP Act. The API itself stores nothing.
- Keep the disclaimer visible. This is a cosmetic assessment, not a medical diagnosis.
- Speed is about 0.2 s per scan on 1 CPU without AI, and about 3 to 6 s with AI.
