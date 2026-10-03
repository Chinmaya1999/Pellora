"""
Computer-vision skin analysis engine.

Pipeline:
  1. Detect the face (YuNet) and 68 landmarks (LBF).
  2. Check photo quality (size, blur, light, pose, eyes open). Bad photos are
     the #1 cause of wrong results, so we reject or down-weight them.
  3. Normalise the face so the distance between the eyes = 100 px.
  4. Cut out skin regions (forehead, cheeks, nose, chin, under-eye, ...).
  5. Measure a raw number for each of the 15 concerns.
  6. Map raw numbers to 0-100 using calibration.json (tune it with
     tools/calibrate.py and your own labelled photos).
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass

import cv2
import numpy as np
from skimage.filters import sato

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(BASE, "models")
U = 100.0  # normalised inter-eye distance in pixels

# live auto-capture thresholds (tuned on test frames; adjust if your cameras differ)
SHARP_MIN = 55.0     # Laplacian variance of the face at 128x154 (sharp frames read 200+, blurred ones < 50)
DARK_MIN = 72        # mean grey level of the face
BRIGHT_MAX = 215

METRICS = [
    "spots", "pores", "texture", "redness", "dark_circles", "wrinkles", "acne",
    "oiliness", "moisture", "firmness", "radiance", "eye_bags",
    "upper_eyelid_droopiness", "lower_eyelid_droopiness", "under_eye_hollows",
]

LABELS = {
    "spots": "Spots", "pores": "Pores", "texture": "Texture", "redness": "Redness",
    "dark_circles": "Dark Circles", "wrinkles": "Wrinkles", "acne": "Acne",
    "oiliness": "Oiliness", "moisture": "Moisture", "firmness": "Firmness",
    "radiance": "Radiance", "eye_bags": "Eye Bags",
    "upper_eyelid_droopiness": "Upper Eyelid Droopiness",
    "lower_eyelid_droopiness": "Lower Eyelid Droopiness",
    "under_eye_hollows": "Under-Eye Hollows",
}

# How reliable each measurement is from a single phone photo (0-1).
# Colour/brightness-based metrics are strong; things that need 3D depth or touch
# (moisture, firmness, bags, hollows) are inherently weaker from 2D images.
BASE_RELIABILITY = {
    "spots": 0.80, "pores": 0.65, "texture": 0.70, "redness": 0.80,
    "dark_circles": 0.78, "wrinkles": 0.72, "acne": 0.75, "oiliness": 0.70,
    "moisture": 0.45, "firmness": 0.50, "radiance": 0.70, "eye_bags": 0.60,
    "upper_eyelid_droopiness": 0.70, "lower_eyelid_droopiness": 0.65,
    "under_eye_hollows": 0.55,
}


class AnalysisError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Face:
    img: np.ndarray        # normalised BGR face image
    lm: np.ndarray         # 68x2 landmarks in normalised image coords
    orig_ipd: float        # inter-eye distance in the original photo (px)
    M: np.ndarray | None = None  # original -> normalised affine (2x3)


class SkinAnalyzer:
    def __init__(self, calibration_path: str | None = None):
        self.detector = cv2.FaceDetectorYN.create(
            os.path.join(MODELS, "yunet.onnx"), "", (320, 320), 0.8, 0.3, 5000)
        self.facemark = cv2.face.createFacemarkLBF()
        self.facemark.loadModel(os.path.join(MODELS, "lbfmodel.yaml"))
        path = calibration_path or os.path.join(BASE, "calibration.json")
        with open(path) as f:
            self.calib = json.load(f)

    # ------------------------------------------------------------------ face
    def _detect(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        faces = None
        # YuNet misses faces that fill most of the frame (close-up selfies),
        # so retry on smaller copies of the photo and map the box back.
        for scale in (1.0, 0.6, 0.4):
            im = img if scale == 1.0 else cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            self.detector.setInputSize((im.shape[1], im.shape[0]))
            _, found = self.detector.detect(im)
            if found is not None and len(found) > 0:
                faces = found.copy()
                faces[:, :14] /= scale
                break
        if faces is None:
            raise AnalysisError("no_face", "No face found. Face the camera in good, even light.")
        # largest face
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        return faces[0]

    def _landmarks(self, img: np.ndarray, box) -> np.ndarray:
        x, y, w, h = [float(v) for v in box[:4]]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        ok, lms = self.facemark.fit(gray, np.array([[x, y, w, h]], dtype=np.int32))
        if not ok:
            raise AnalysisError("no_landmarks", "Could not locate facial features.")
        return np.asarray(lms[0], dtype=np.float64).reshape(-1, 2)

    def _normalise(self, img: np.ndarray, lm: np.ndarray) -> Face:
        le, re = lm[36:42].mean(0), lm[42:48].mean(0)
        ipd = float(np.linalg.norm(re - le))
        angle = math.degrees(math.atan2(re[1] - le[1], re[0] - le[0]))
        scale = U / ipd
        centre = tuple(((le + re) / 2).tolist())
        M = cv2.getRotationMatrix2D(centre, angle, scale)
        # output canvas: 3.2u wide, 4u tall; eyes at (1.6u, 1.5u)
        W, H = int(3.2 * U), int(4.0 * U)
        M[0, 2] += W / 2 - centre[0]
        M[1, 2] += 1.5 * U - centre[1]
        interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
        out = cv2.warpAffine(img, M, (W, H), flags=interp, borderMode=cv2.BORDER_REFLECT)
        lm2 = (M[:, :2] @ lm.T).T + M[:, 2]
        return Face(out, lm2, ipd, M)

    # --------------------------------------------------------------- quality
    def _quality(self, img: np.ndarray, face: Face, box) -> dict:
        issues, factor = [], 1.0
        lm = face.lm
        if face.orig_ipd < 45:
            raise AnalysisError("face_too_small", "Face is too small/far. Move closer so your face fills the frame.")
        if face.orig_ipd < 90:
            issues.append("low_resolution"); factor *= 0.75
        elif face.orig_ipd < 150:
            factor *= 0.92

        g = cv2.cvtColor(face.img, cv2.COLOR_BGR2GRAY)
        roi = g[int(lm[19, 1]):int(lm[8, 1]), int(lm[1, 0]):int(lm[15, 0])]
        sharp = cv2.Laplacian(roi, cv2.CV_64F).var() if roi.size else 0
        if sharp < 15:
            issues.append("blurry"); factor *= 0.7

        L = cv2.cvtColor(face.img, cv2.COLOR_BGR2LAB)[:, :, 0]
        mean_l = float(np.median(L[int(lm[29, 1]) - 20:int(lm[33, 1]), int(lm[2, 0]):int(lm[14, 0])]))
        if mean_l < 60:
            raise AnalysisError("too_dark", "Photo is too dark. Face a window or a bright light.")
        if mean_l < 95:
            issues.append("dim_lighting"); factor *= 0.85
        if mean_l > 225:
            issues.append("overexposed"); factor *= 0.8

        lc = self._region_stats(face, "cheek_l")["L"]
        rc = self._region_stats(face, "cheek_r")["L"]
        if abs(lc - rc) > 22:
            issues.append("uneven_lighting"); factor *= 0.85

        # head turn: nose tip offset from eye midline
        mid = (lm[36:42].mean(0)[0] + lm[42:48].mean(0)[0]) / 2
        yaw = abs(lm[30, 0] - mid) / U
        if yaw > 0.3:
            raise AnalysisError("face_turned", "Please look straight at the camera.")
        if yaw > 0.12:
            issues.append("face_turned"); factor *= 0.85

        ear = (self._ear(lm[36:42]) + self._ear(lm[42:48])) / 2
        if ear < 0.12:
            raise AnalysisError("eyes_closed", "Please keep your eyes open and relaxed.")

        mouth = abs(lm[66, 1] - lm[62, 1]) / U
        if mouth > 0.12:
            issues.append("expression"); factor *= 0.85  # smiling/talking distorts wrinkles & folds

        if float(box[-1]) < 0.85:
            factor *= 0.9
        return {"score": round(factor * 100), "issues": issues, "factor": factor,
                "face_size_px": round(face.orig_ipd, 1), "sharpness": round(float(sharp), 1),
                "brightness": round(mean_l, 1)}

    @staticmethod
    def _ear(eye: np.ndarray) -> float:
        a = np.linalg.norm(eye[1] - eye[5]); b = np.linalg.norm(eye[2] - eye[4])
        c = np.linalg.norm(eye[0] - eye[3])
        return float((a + b) / (2 * c))

    # --------------------------------------------------------------- regions
    def _regions(self, face: Face) -> dict[str, tuple[int, int, int, int]]:
        lm = face.lm
        u = U
        brow_top = min(lm[17:27, 1])
        eye_l_bot = max(lm[40, 1], lm[41, 1])
        eye_r_bot = max(lm[46, 1], lm[47, 1])
        r = {
            "forehead": (lm[19, 0], brow_top - 0.65 * u, lm[24, 0], brow_top - 0.12 * u),
            "nose": (lm[31, 0] + 0.05 * u, lm[28, 1], lm[35, 0] - 0.05 * u, lm[33, 1] - 0.05 * u),
            "cheek_l": (lm[1, 0] + 0.22 * u, eye_l_bot + 0.38 * u, lm[31, 0] - 0.12 * u, lm[33, 1] + 0.12 * u),
            "cheek_r": (lm[35, 0] + 0.12 * u, eye_r_bot + 0.38 * u, lm[15, 0] - 0.22 * u, lm[33, 1] + 0.12 * u),
            "chin": (lm[7, 0] + 0.05 * u, lm[57, 1] + 0.12 * u, lm[9, 0] - 0.05 * u, lm[8, 1] - 0.1 * u),
            "undereye_l": (lm[36, 0] + 0.05 * u, eye_l_bot + 0.06 * u, lm[39, 0], eye_l_bot + 0.28 * u),
            "undereye_r": (lm[42, 0], eye_r_bot + 0.06 * u, lm[45, 0] - 0.05 * u, eye_r_bot + 0.28 * u),
            "trough_l": (lm[39, 0] - 0.22 * u, eye_l_bot + 0.18 * u, lm[39, 0] + 0.02 * u, eye_l_bot + 0.42 * u),
            "trough_r": (lm[42, 0] - 0.02 * u, eye_r_bot + 0.18 * u, lm[42, 0] + 0.22 * u, eye_r_bot + 0.42 * u),
            "crow_l": (lm[36, 0] - 0.38 * u, lm[36, 1] - 0.15 * u, lm[36, 0] - 0.06 * u, lm[36, 1] + 0.22 * u),
            "crow_r": (lm[45, 0] + 0.06 * u, lm[45, 1] - 0.15 * u, lm[45, 0] + 0.38 * u, lm[45, 1] + 0.22 * u),
            "lid_l": (lm[37, 0] - 0.05 * u, lm[19, 1] + 0.08 * u, lm[38, 0] + 0.05 * u, min(lm[37, 1], lm[38, 1]) - 0.03 * u),
            "lid_r": (lm[43, 0] - 0.05 * u, lm[24, 1] + 0.08 * u, lm[44, 0] + 0.05 * u, min(lm[43, 1], lm[44, 1]) - 0.03 * u),
            "nasolabial_l": (lm[48, 0] - 0.22 * u, lm[31, 1], lm[48, 0] + 0.02 * u, lm[48, 1] + 0.05 * u),
            "nasolabial_r": (lm[54, 0] - 0.02 * u, lm[35, 1], lm[54, 0] + 0.22 * u, lm[54, 1] + 0.05 * u),
        }
        H, W = face.img.shape[:2]
        out = {}
        for k, (x0, y0, x1, y1) in r.items():
            x0, x1 = sorted((int(round(x0)), int(round(x1))))
            y0, y1 = sorted((int(round(y0)), int(round(y1))))
            x0, y0 = max(0, x0), max(0, y0)
            x1, y1 = min(W, x1), min(H, y1)
            if x1 - x0 < 4 or y1 - y0 < 4:
                x1, y1 = min(W, x0 + 4), min(H, y0 + 4)
            out[k] = (x0, y0, x1, y1)
        return out

    def _prep(self, face: Face):
        if not hasattr(face, "_lab"):
            img = face.img.astype(np.float32)
            # light grey-world white balance (half strength) to reduce colour casts
            means = img.reshape(-1, 3).mean(0)
            gain = (means.mean() / np.maximum(means, 1)) ** 0.5
            wb = np.clip(img * gain, 0, 255).astype(np.uint8)
            lab = cv2.cvtColor(wb, cv2.COLOR_BGR2LAB).astype(np.float32)
            face._lab = lab
            face._wb = wb
            face._rg = self._regions(face)
            face._skin = self._skin_mask(face)
        return face._lab, face._rg, face._skin

    def _skin_mask(self, face: Face) -> np.ndarray:
        lab = face._lab
        rg = face._rg
        ref = []
        for k in ("cheek_l", "cheek_r", "nose"):
            x0, y0, x1, y1 = rg[k]
            ref.append(lab[y0:y1, x0:x1].reshape(-1, 3))
        ref = np.concatenate(ref)
        med = np.median(ref, 0)
        mad = np.median(np.abs(ref - med), 0) + 1
        d_ab = np.sqrt(((lab[:, :, 1] - med[1]) / (3 * mad[1] + 4)) ** 2 +
                       ((lab[:, :, 2] - med[2]) / (3 * mad[2] + 4)) ** 2)
        d_l = (med[0] - lab[:, :, 0]) / (4 * mad[0] + 25)  # much darker = hair/brow/shadow
        mask = (d_ab < 1.6) & (d_l < 1.6)
        mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        face._skin_ref = med
        return mask.astype(bool)

    def _crop(self, face: Face, name: str, ch=None, mask=True):
        lab, rg, skin = self._prep(face)
        x0, y0, x1, y1 = rg[name]
        c = lab[y0:y1, x0:x1] if ch is None else lab[y0:y1, x0:x1, ch]
        m = skin[y0:y1, x0:x1] if mask else np.ones(c.shape[:2], bool)
        if m.sum() < 0.2 * m.size:  # mask failed (e.g. heavy makeup) -> use all
            m = np.ones(c.shape[:2], bool)
        return c, m

    def _region_stats(self, face: Face, name: str) -> dict:
        c, m = self._crop(face, name)
        px = c[m]
        return {"L": float(np.median(px[:, 0])), "a": float(np.median(px[:, 1])),
                "b": float(np.median(px[:, 2])), "Lstd": float(px[:, 0].std())}

    # -------------------------------------------------------------- features
    def _features(self, face: Face) -> dict[str, float]:
        lab, rg, skin = self._prep(face)
        L = lab[:, :, 0] * (100 / 255)   # 0-100 scale
        A = lab[:, :, 1] - 128
        f: dict[str, float] = {}
        skin_regions = ["forehead", "cheek_l", "cheek_r", "chin", "nose"]

        def crop(arr, name):
            x0, y0, x1, y1 = rg[name]
            m = skin[y0:y1, x0:x1]
            if m.sum() < 0.2 * m.size:
                m = np.ones_like(m)
            return arr[y0:y1, x0:x1], m

        # -- spots: dark blobs larger than pores (blackhat), not red
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
        bh = cv2.morphologyEx(L.astype(np.float32), cv2.MORPH_BLACKHAT, k)
        a_bg = cv2.GaussianBlur(A, (0, 0), 6)
        tot_area = spot_area = 0
        for r in ["forehead", "cheek_l", "cheek_r", "chin"]:
            b, m = crop(bh, r); ar, _ = crop(A - a_bg, r)
            cand = ((b > 3.2) & m & (ar < 4)).astype(np.uint8)
            n, lab_cc, stats, _ = cv2.connectedComponentsWithStats(cand)
            for i in range(1, n):
                area = stats[i, cv2.CC_STAT_AREA]
                w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
                if 6 <= area <= 400 and max(w, h) / max(1, min(w, h)) < 3:
                    spot_area += area
            tot_area += m.sum()
        f["spots"] = 100 * spot_area / max(1, tot_area)

        # -- pores: tiny dark dots on nose + cheeks
        k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        bh2 = cv2.morphologyEx(L.astype(np.float32), cv2.MORPH_BLACKHAT, k2)
        cnt = area = 0
        for r in ["nose", "cheek_l", "cheek_r"]:
            b, m = crop(bh2, r)
            cand = ((b > 1.8) & m).astype(np.uint8)
            n, _, stats, _ = cv2.connectedComponentsWithStats(cand)
            cnt += int(((stats[1:, cv2.CC_STAT_AREA] >= 1) & (stats[1:, cv2.CC_STAT_AREA] <= 12)).sum())
            area += m.sum()
        f["pores"] = 1000 * cnt / max(1, area)

        # -- texture: fine-scale luminance roughness
        hp = L - cv2.GaussianBlur(L, (0, 0), 3)
        vals = []
        for r in ["forehead", "cheek_l", "cheek_r"]:
            c, m = crop(hp, r); vals.append(c[m])
        v = np.concatenate(vals)
        f["texture"] = float(np.percentile(np.abs(v), 90))

        # -- redness: absolute a* on cheeks + fraction of strongly red pixels
        a_vals = np.concatenate([crop(A, r)[0][crop(A, r)[1]] for r in ["cheek_l", "cheek_r", "nose", "chin"]])
        face_a = float(np.median(a_vals))
        f["redness"] = face_a + 0.4 * 100 * float((a_vals > face_a + 6).mean())
        f["_a_median"] = face_a

        # -- acne: small raised red blobs vs local background
        ra = A - cv2.GaussianBlur(A, (0, 0), 8)
        acne = 0
        for r in ["forehead", "cheek_l", "cheek_r", "chin", "nose"]:
            c, m = crop(ra, r)
            cand = ((c > 5) & m).astype(np.uint8)
            n, _, stats, _ = cv2.connectedComponentsWithStats(cand)
            for i in range(1, n):
                a_ = stats[i, cv2.CC_STAT_AREA]
                w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
                if 8 <= a_ <= 300 and max(w, h) / max(1, min(w, h)) < 2.5:
                    acne += 1
        f["acne"] = float(acne)

        # -- oiliness: specular highlights in T-zone
        Lr = []
        for r in ["forehead", "nose", "chin"]:
            c, m = crop(L, r); Lr.append(c[m])
        Lt = np.concatenate(Lr)
        Lc = np.concatenate([crop(L, r)[0][crop(L, r)[1]] for r in ["cheek_l", "cheek_r"]])
        base = float(np.median(Lc))
        f["oiliness"] = 100 * float((Lt > base + 13).mean()) + 0.5 * max(0, float(np.median(Lt)) - base)

        # -- dark circles: under-eye darker than cheek
        ue = np.concatenate([crop(L, r)[0][crop(L, r)[1]] for r in ["undereye_l", "undereye_r"]])
        f["dark_circles"] = base - float(np.median(ue))
        ue_b = np.concatenate([crop(lab[:, :, 2] - 128, r)[0].ravel() for r in ["undereye_l", "undereye_r"]])
        f["_undereye_b"] = float(np.median(ue_b))

        # -- under-eye hollows: medial tear trough darker than cheek and lateral under-eye
        tt = np.concatenate([crop(L, r)[0].ravel() for r in ["trough_l", "trough_r"]])
        f["under_eye_hollows"] = 0.7 * (base - float(np.percentile(tt, 25))) + 0.3 * (float(np.median(ue)) - float(np.median(tt)))

        # -- eye bags: dark crease band below the bulge (vertical profile minimum)
        bags = []
        lm = face.lm
        for xs, ybot in [((lm[36, 0], lm[39, 0]), max(lm[40, 1], lm[41, 1])),
                         ((lm[42, 0], lm[45, 0]), max(lm[46, 1], lm[47, 1]))]:
            x0, x1 = int(xs[0] + 0.1 * U), int(xs[1] - 0.05 * U)
            y0, y1 = int(ybot + 0.05 * U), int(min(L.shape[0] - 1, ybot + 0.65 * U))
            prof = cv2.GaussianBlur(L[y0:y1, x0:x1].mean(1).reshape(-1, 1), (1, 7), 0).ravel()
            if len(prof) < 10:
                continue
            third = len(prof) // 3
            upper = prof[:third].max()
            lower_min = prof[third:].min()
            bags.append(max(0.0, min(upper, base) - lower_min))
        f["eye_bags"] = float(np.mean(bags)) if bags else 0.0

        # -- wrinkles: dark ridge (line) density on forehead, crow's feet, under-eye
        wr = 0.0; area = 0
        for r, sig in [("forehead", [1.5, 2.5]), ("crow_l", [1, 1.8]), ("crow_r", [1, 1.8]),
                       ("undereye_l", [1, 1.5]), ("undereye_r", [1, 1.5])]:
            c, m = crop(L, r)
            if c.shape[0] < 8 or c.shape[1] < 8:
                continue
            rid = sato(c.astype(float), sigmas=sig, black_ridges=True)
            cand = ((rid > 1.2) & m).astype(np.uint8)
            n, _, stats, _ = cv2.connectedComponentsWithStats(cand)
            for i in range(1, n):
                w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
                if max(w, h) >= 10 and max(w, h) / max(1, min(w, h)) >= 2.5:
                    wr += stats[i, cv2.CC_STAT_AREA]
            area += m.sum()
        f["wrinkles"] = 100 * wr / max(1, area)

        # -- firmness: nasolabial fold depth + jaw contour sag
        nl = []
        for r in ["nasolabial_l", "nasolabial_r"]:
            c, _ = crop(L, r)
            nl.append(base - float(np.percentile(c, 15)))
        jaw = lm[4:13]
        jaw_drop = float((jaw[:, 1].max() - lm[33, 1]) / U)  # lower-face length vs eye distance
        jaw_width = float((lm[12, 0] - lm[4, 0]) / U)
        f["_nasolabial"] = float(np.mean(nl))
        f["firmness"] = float(np.mean(nl)) + 15 * max(0, jaw_width - 1.25) + 10 * max(0, jaw_drop - 0.95)

        # -- radiance: brightness, evenness and soft glow
        lf = []
        for r in ["forehead", "cheek_l", "cheek_r", "chin"]:
            c, m = crop(cv2.GaussianBlur(L, (0, 0), 6), r); lf.append(np.median(c[m]))
        evenness = float(np.std(lf))
        tone_std = float(np.concatenate([crop(L, r)[0][crop(L, r)[1]] for r in ["cheek_l", "cheek_r"]]).std())
        f["radiance"] = 0.45 * base - 1.2 * evenness - 0.8 * tone_std - 1.5 * f["dark_circles"] * 0.3 \
            + 0.3 * min(f["oiliness"], 15)
        f["_brightness"] = base

        # -- moisture: smooth + no flaking + healthy sheen (proxy only)
        flakes = L - cv2.GaussianBlur(L, (0, 0), 1.5)
        fl = np.concatenate([crop(flakes, r)[0][crop(flakes, r)[1]] for r in ["cheek_l", "cheek_r", "chin"]])
        flake_frac = 100 * float((fl > 3.5).mean())
        f["moisture"] = 0.6 * f["texture"] + 0.25 * flake_frac - 0.12 * min(f["oiliness"], 20)

        # -- eyelids (geometry)
        def eye_geom(eye, brow_pts):
            w = np.linalg.norm(eye[3] - eye[0])
            up = (eye[1][1] + eye[2][1]) / 2
            lo = (eye[4][1] + eye[5][1]) / 2
            corners = (eye[0][1] + eye[3][1]) / 2
            opening = (lo - up) / w                 # eye aspect
            lid_above = (corners - up) / w          # upper lid arch above corner line
            sag = (lo - corners) / w                # lower lid below corner line
            brow_gap = (up - brow_pts[:, 1].mean()) / U
            return opening, lid_above, sag, brow_gap
        g_l = eye_geom(lm[36:42], lm[17:22]); g_r = eye_geom(lm[42:48], lm[22:27])
        opening = (g_l[0] + g_r[0]) / 2
        lid_above = (g_l[1] + g_r[1]) / 2
        brow_gap = (g_l[3] + g_r[3]) / 2
        sag = (g_l[2] + g_r[2]) / 2
        # canthal tilt (outer corner lower than inner -> positive here = droopy)
        tilt_l = (lm[36, 1] - lm[39, 1]) / U
        tilt_r = (lm[45, 1] - lm[42, 1]) / U
        tilt = (tilt_l + tilt_r) / 2
        lid_l = self._region_stats(face, "lid_l")["L"]; lid_r = self._region_stats(face, "lid_r")["L"]
        lid_shadow = (base * 255 / 100 - (lid_l + lid_r) / 2) * 100 / 255
        f["upper_eyelid_droopiness"] = 100 * (0.33 - opening) + 60 * (0.6 - brow_gap) + 0.3 * lid_shadow
        f["lower_eyelid_droopiness"] = 100 * (sag - 0.10) + 120 * tilt
        f["_eye_opening"], f["_brow_gap"], f["_lid_sag"], f["_canthal_tilt"] = opening, brow_gap, sag, tilt
        return f

    # ----------------------------------------------------------------- score
    def _to_score(self, metric: str, raw: float) -> float:
        """Map raw feature -> concern 0..100 using piecewise-linear calibration."""
        c = self.calib[metric]
        if "linear" in c:  # fitted by tools/calibrate.py
            return float(np.clip(c["linear"][0] * raw + c["linear"][1], 0, 100))
        lo, hi = c["clear"], c["severe"]
        t = (raw - lo) / (hi - lo)
        return float(np.clip(t, 0, 1) * 100)

    @staticmethod
    def rating(score: float) -> str:
        return "Excellent" if score >= 85 else "Good" if score >= 70 else "Fair" if score >= 50 else "Poor"

    @staticmethod
    def level(concern: float) -> str:
        return "none" if concern < 20 else "mild" if concern < 45 else "moderate" if concern < 70 else "severe"

    # ----------------------------------------------------------- live check
    # The on-screen guide oval (static/ + portal playground CSS: inset 12% 20% 14% of a 3:4 stage).
    OVAL = (0.50, 0.49, 0.30, 0.37)  # centre x, centre y, radius x, radius y (fractions of the view)

    def _glasses_score(self, img, lm, face=None) -> float:
        """>1 means eyeglasses likely. Edge energy on the nose bridge + a ring around each eye."""
        face = face or self._normalise(img, lm)
        L = face.lm
        g = cv2.GaussianBlur(cv2.cvtColor(face.img, cv2.COLOR_BGR2GRAY), (3, 3), 0)
        x0, x1 = int(L[39, 0] + 0.04 * U), int(L[42, 0] - 0.04 * U)
        y0, y1 = int(min(L[39, 1], L[42, 1]) - 0.12 * U), int(max(L[39, 1], L[42, 1]) + 0.22 * U)
        roi = g[max(0, y0):y1, max(0, x0):x1]
        if roi.size == 0:
            return 0.0
        bridge = float(cv2.Canny(roi, 40, 110).mean() / 255)
        inner = np.zeros(g.shape, np.uint8)
        for idx in (range(36, 42), range(42, 48)):
            cv2.fillPoly(inner, [np.round(L[list(idx)]).astype(np.int32)], 255)
        big = cv2.dilate(inner, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(0.62 * U) | 1, int(0.50 * U) | 1)))
        small = cv2.dilate(inner, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(0.22 * U) | 1, int(0.18 * U) | 1)))
        band = cv2.subtract(big, small) > 0
        rim = float((cv2.Canny(g, 40, 110)[band] > 0).mean()) if band.any() else 0.0
        # measured: bare faces ~ bridge 0.03 / rim 0.05-0.07 ; glasses ~ bridge 0.09-0.14 / rim 0.13-0.15
        return max(min(bridge / 0.07, rim / 0.105), bridge / 0.13, rim / 0.16)

    def check(self, img: np.ndarray) -> dict:
        """Live framing check for auto-capture. `img` is the camera view cropped like the on-screen stage (3:4).
        Returns {ready, code, message, checks{...}} - `message` is short enough to show AND speak."""
        h, w = img.shape[:2]
        checks = {"circle": False, "pose": False, "eyes": False, "glasses": False, "light": False, "sharp": False}

        def out(code, msg, ready=False, **extra):
            return {"ready": ready, "code": code, "message": msg, "checks": dict(checks), **extra}

        try:
            box = self._detect(img)
        except AnalysisError:
            return out("no_face", "I can't see your face. Look at the camera")
        try:
            lm = self._landmarks(img, box)
        except AnalysisError:
            return out("hold_still", "Hold still")
        le, re = lm[36:42].mean(0), lm[42:48].mean(0)
        ipd = float(np.linalg.norm(re - le))
        if ipd < 8:
            return out("hold_still", "Hold still")

        # ---- 1. face fully inside the circle, right size
        # Uses the detector box (steady even with glasses / slight blur) plus the jaw & chin points.
        cx, cy, rx, ry = self.OVAL
        bx, by, bw, bh = [float(v) for v in box[:4]]
        size = bw / w / (2 * rx)                       # face width vs circle width
        ox = ((bx + bw / 2) / w - cx) / rx             # + : face is right of centre in the frame
        oy = ((by + bh / 2) / h - cy) / ry             # + : face is low
        jaw = lm[[0, 8, 16]]
        e_jaw = (((jaw[:, 0] / w - cx) / rx) ** 2 + ((jaw[:, 1] / h - cy) / ry) ** 2).max()
        top_out = (by / h) < (cy - ry) - 0.02          # forehead above the circle
        # the screen is mirrored, so a face on the frame's right shows on the screen's left
        if size < 0.60:
            return out("too_far", "Move a little closer")
        if size > 1.05:
            return out("too_close", "Move back a little")
        if abs(ox) > 0.18:
            return out("off_center", "Move to your right" if ox > 0 else "Move to your left")
        if abs(oy) > 0.16 or top_out:
            return out("off_center", "Move your face up" if oy > 0 else "Move your face down")
        if e_jaw > 1.12:  # centred but the jaw touches the circle edge: a bit too big
            return out("too_close", "Move back a little")
        checks["circle"] = True

        # ---- 2. pose: straight, level, not tilted up/down
        yaw = abs(lm[30, 0] - (le[0] + re[0]) / 2) / ipd
        roll = abs(math.degrees(math.atan2(re[1] - le[1], re[0] - le[0])))
        eye_y = (le[1] + re[1]) / 2
        pitch = (lm[33, 1] - eye_y) / max(1.0, (lm[8, 1] - eye_y))
        if yaw > 0.13:
            return out("turned", "Look straight at the camera")
        if roll > 6:
            return out("tilted", "Keep your head level")
        if pitch < 0.40:
            return out("pitch_down", "Lift your chin a little")
        if pitch > 0.66:
            return out("pitch_up", "Lower your chin a little")
        checks["pose"] = True

        # ---- 3. eyeglasses
        gscore = self._glasses_score(img, lm)
        if gscore >= 1.0:
            return out("glasses", "Please take off your glasses", glasses_score=round(gscore, 2))
        checks["glasses"] = True

        # ---- 4. eyes open, neutral mouth
        if (self._ear(lm[36:42]) + self._ear(lm[42:48])) / 2 < 0.17:
            return out("eyes_closed", "Open your eyes wide")
        checks["eyes"] = True

        # ---- 5. lighting
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        x0, x1 = int(lm[1, 0]), int(lm[15, 0])
        forehead = np.array([(lm[19, 0] + lm[24, 0]) / 2, lm[17:27, 1].min() - 0.45 * ipd])
        y0, y1 = int(forehead[1]), int(lm[8, 1])
        face_g = g[max(0, y0):y1, max(0, x0):x1]
        if face_g.size == 0:
            return out("hold_still", "Hold still")
        mean_l = float(face_g.mean())
        side = max(6, int(0.30 * ipd))
        def patch(px, py):
            px, py = int(px), int(py)
            return float(g[max(0, py - side // 2):py + side // 2, max(0, px - side // 2):px + side // 2].mean())
        cheek_y = eye_y + 0.55 * ipd
        halves = (patch((lm[2, 0] + lm[31, 0]) / 2, cheek_y), patch((lm[14, 0] + lm[35, 0]) / 2, cheek_y))
        bg = np.concatenate([g[: int(0.08 * h)].ravel(), g[:, : int(0.08 * w)].ravel(), g[:, int(0.92 * w):].ravel()])
        if mean_l < DARK_MIN:
            return out("dark", "It's too dark. Face a light or window", brightness=round(mean_l))
        if mean_l > BRIGHT_MAX:
            return out("bright", "Too bright. Move away from the strong light", brightness=round(mean_l))
        if abs(halves[0] - halves[1]) > 40:
            return out("uneven", "Light is uneven. Face the light straight on", brightness=round(mean_l))
        if float(bg.mean()) > 150 and mean_l < 0.62 * float(bg.mean()):
            return out("backlit", "The light is behind you. Turn to face it", brightness=round(mean_l))
        checks["light"] = True

        # ---- 6. clarity (sharp face, camera focused)
        crop = cv2.resize(face_g, (128, 154), interpolation=cv2.INTER_AREA)  # fixed size => same scale at any camera resolution
        sharp = float(cv2.Laplacian(crop, cv2.CV_64F).var())
        if sharp < SHARP_MIN:
            return out("blurry", "The picture is blurry. Hold still", sharpness=round(sharp, 1))
        checks["sharp"] = True
        return out("ready", "Perfect. Hold still", ready=True, sharpness=round(sharp, 1), brightness=round(mean_l), glasses_score=round(gscore, 2))

    # ------------------------------------------------------------------- run
    def analyze(self, img: np.ndarray, want_overlay: bool = False, want_overlays: bool = False, only: list[str] | None = None) -> dict:
        keys = [m for m in METRICS if only is None or m in only] or list(METRICS)  # plans can include fewer parameters
        if img is None or img.size == 0:
            raise AnalysisError("bad_image", "Could not read the image.")
        h, w = img.shape[:2]
        if max(h, w) > 2000:  # keep processing fast
            s = 2000 / max(h, w)
            img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        box = self._detect(img)
        lm = self._landmarks(img, box)
        face = self._normalise(img, lm)
        quality = self._quality(img, face, box)
        feats = self._features(face)

        results = {}
        for m in keys:
            concern = self._to_score(m, feats[m])
            conf = BASE_RELIABILITY[m] * quality["factor"]
            if m == "pores" and face.orig_ipd < 150:
                conf *= 0.75  # pores need a close-up photo
            results[m] = {
                "label": LABELS[m],
                "score": round(100 - concern),        # 100 = excellent skin
                "concern": round(concern),            # 0 = no concern
                "level": self.level(concern),
                "confidence": round(conf, 2),
                "raw": round(float(feats[m]), 3),
                "key": m,
                "rating": self.rating(100 - concern),
            }
        overall = round(np.average([r["score"] for r in results.values()],
                                   weights=[BASE_RELIABILITY[m] for m in keys]))
        out = {"overall_score": int(overall), "metrics": results, "quality": {
            k: v for k, v in quality.items() if k != "factor"},
            "debug": {k: round(float(v), 3) for k, v in feats.items() if k.startswith("_")}}
        if want_overlay:
            out["_overlay"] = self._overlay(face)
        if want_overlays:  # per-metric masks drawn on the original photo
            from .overlays import render_all
            for k, b64 in render_all(self, face, img, keys).items():
                results[k]["overlay_jpeg_base64"] = b64
        return out

    def _overlay(self, face: Face) -> np.ndarray:
        img = face.img.copy()
        _, rg, skin = self._prep(face)
        tint = img.copy(); tint[~skin] = (tint[~skin] * 0.4).astype(np.uint8)
        img = cv2.addWeighted(img, 0.5, tint, 0.5, 0)
        for k, (x0, y0, x1, y1) in rg.items():
            cv2.rectangle(img, (x0, y0), (x1, y1), (80, 200, 255), 1)
        for (x, y) in face.lm.astype(int):
            cv2.circle(img, (int(x), int(y)), 1, (0, 255, 0), -1)
        return img
