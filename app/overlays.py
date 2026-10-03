"""
Per-metric overlay images: the original photo with a mask drawn on the area each
metric looked at (circles on spots, heat map for moisture, outlines for eyelids...).

Everything is drawn in the aligned face space (inter-eye distance = 100 px, the same
space the measurements use) onto a transparent layer, then warped back onto the
original photo and alpha-blended.
"""
from __future__ import annotations

import base64

import cv2
import numpy as np
from skimage.filters import sato

from .analyzer import U, METRICS

PINK = (210, 90, 235)      # BGR
PURPLE = (190, 60, 150)
BLUE = (190, 110, 70)
YELLOW = (0, 215, 255)
ORANGE = (0, 150, 255)
RED = (60, 60, 255)
WHITE = (255, 255, 255)
CYAN = (255, 240, 130)


class Layer:
    """Transparent drawing surface in face space."""

    def __init__(self, shape):
        h, w = shape[:2]
        self.rgb = np.zeros((h, w, 3), np.uint8)
        self.a = np.zeros((h, w), np.float32)

    def _put(self, m: np.ndarray, color, alpha=1.0, soft=0.8):
        mf = cv2.GaussianBlur(m, (0, 0), soft).astype(np.float32) / 255.0 * alpha if soft else m.astype(np.float32) / 255.0 * alpha
        upd = mf > 0.02
        self.rgb[upd] = color
        self.a = np.maximum(self.a, mf)

    def line(self, pts, color, th=2, closed=False, alpha=1.0):
        m = np.zeros(self.a.shape, np.uint8)
        cv2.polylines(m, [np.round(pts).astype(np.int32)], closed, 255, th, cv2.LINE_AA)
        self._put(m, color, alpha)

    def fill(self, pts, color, alpha=0.5):
        m = np.zeros(self.a.shape, np.uint8)
        cv2.fillPoly(m, [np.round(pts).astype(np.int32)], 255, cv2.LINE_AA)
        self._put(m, color, alpha, soft=2.0)

    def ellipse(self, c, axes, angle, color, alpha=0.5, th=-1):
        m = np.zeros(self.a.shape, np.uint8)
        cv2.ellipse(m, (int(c[0]), int(c[1])), (max(1, int(axes[0])), max(1, int(axes[1]))), angle, 0, 360, 255, th, cv2.LINE_AA)
        self._put(m, color, alpha, soft=2.0 if th < 0 else 0.8)

    def circle(self, c, r, color, th=2, alpha=1.0):
        m = np.zeros(self.a.shape, np.uint8)
        cv2.circle(m, (int(c[0]), int(c[1])), int(r), 255, th, cv2.LINE_AA)
        self._put(m, color, alpha)

    def mask(self, boolmask, color, alpha=0.55, soft=1.5):
        self._put((boolmask.astype(np.uint8) * 255), color, alpha, soft=soft)

    def heat(self, values, region, alpha=0.6, soft=3.0):
        """values 0..1 -> JET colours inside region."""
        v = cv2.GaussianBlur(values.astype(np.float32), (0, 0), soft)
        col = cv2.applyColorMap((np.clip(v, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_JET)
        a = cv2.GaussianBlur(region.astype(np.float32), (0, 0), 2.0) * alpha
        upd = a > 0.02
        self.rgb[upd] = col[upd]
        self.a = np.maximum(self.a, a)

    def tint(self, values, region, color, max_alpha=0.65, soft=2.0):
        """Single colour whose strength follows values 0..1."""
        v = cv2.GaussianBlur(np.clip(values, 0, 1).astype(np.float32), (0, 0), soft)
        a = v * cv2.GaussianBlur(region.astype(np.float32), (0, 0), 1.5) * max_alpha
        upd = a > 0.02
        self.rgb[upd] = color
        self.a = np.maximum(self.a, a)


def _bezier(p0, p1, p2, n=24):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * np.asarray(p0) + 2 * (1 - t) * t * np.asarray(p1) + t ** 2 * np.asarray(p2)


class Ctx:
    def __init__(self, an, face):
        self.face = face
        self.lm = face.lm
        lab, self.rg, self.skin = an._prep(face)
        self.L = lab[:, :, 0] * (100 / 255)
        self.A = lab[:, :, 1] - 128
        self.shape = face.img.shape
        self.skin_full = self.skin.copy()

    def crop(self, arr, name):
        x0, y0, x1, y1 = self.rg[name]
        m = self.skin[y0:y1, x0:x1]
        if m.sum() < 0.2 * m.size:
            m = np.ones_like(m)
        return arr[y0:y1, x0:x1], m, (x0, y0)

    def region_mask(self, names):
        m = np.zeros(self.shape[:2], bool)
        for n in names:
            c, mm, (x0, y0) = self.crop(self.L, n)
            m[y0:y0 + mm.shape[0], x0:x0 + mm.shape[1]] |= mm
        return m

    def face_poly(self):
        lm = self.lm
        top = (lm[17:27][::-1] + np.array([0, -0.55 * U]))
        return np.vstack([lm[0:17], top]).astype(np.float32)

    def face_region(self):
        """Skin pixels inside the face outline (no hair/background)."""
        m = np.zeros(self.shape[:2], np.uint8)
        cv2.fillPoly(m, [np.round(self.face_poly()).astype(np.int32)], 1)
        return (m > 0) & self.skin

    def base_L(self):
        v = np.concatenate([self.crop(self.L, r)[0][self.crop(self.L, r)[1]] for r in ("cheek_l", "cheek_r")])
        return float(np.median(v))


# --------------------------------------------------------------- metric painters
def _spots(c: Ctx, ly: Layer):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    bh = cv2.morphologyEx(c.L.astype(np.float32), cv2.MORPH_BLACKHAT, k)
    a_bg = cv2.GaussianBlur(c.A, (0, 0), 6)
    for r in ("forehead", "cheek_l", "cheek_r", "chin"):
        b, m, (x0, y0) = c.crop(bh, r)
        ar, _, _ = c.crop(c.A - a_bg, r)
        cand = ((b > 3.2) & m & (ar < 4)).astype(np.uint8)
        n, _, st, cen = cv2.connectedComponentsWithStats(cand)
        for i in range(1, n):
            area, w, h = st[i, cv2.CC_STAT_AREA], st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
            if 6 <= area <= 400 and max(w, h) / max(1, min(w, h)) < 3:
                ly.circle((x0 + cen[i][0], y0 + cen[i][1]), max(5, np.sqrt(area / np.pi) + 4), ORANGE, 2)


def _pores(c: Ctx, ly: Layer):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bh = cv2.morphologyEx(c.L.astype(np.float32), cv2.MORPH_BLACKHAT, k)
    for r in ("nose", "cheek_l", "cheek_r"):
        b, m, (x0, y0) = c.crop(bh, r)
        cand = ((b > 1.8) & m).astype(np.uint8)
        n, _, st, cen = cv2.connectedComponentsWithStats(cand)
        for i in range(1, n):
            if 1 <= st[i, cv2.CC_STAT_AREA] <= 12:
                ly.circle((x0 + cen[i][0], y0 + cen[i][1]), 2, YELLOW, -1)


def _texture(c: Ctx, ly: Layer):
    hp = np.abs(c.L - cv2.GaussianBlur(c.L, (0, 0), 3))
    reg = c.face_region()
    ly.heat(hp / 7.0, reg, alpha=0.55, soft=3.5)


def _redness(c: Ctx, ly: Layer):
    reg = c.face_region()
    med = float(np.median(c.A[reg])) if reg.any() else 0
    ly.tint((c.A - med) / 10.0, reg, RED, max_alpha=0.7, soft=3.0)


def _eye_frames(c: Ctx):
    lm = c.lm
    for outer, inner, lo in ((36, 39, (41, 40)), (45, 42, (46, 47))):
        yield lm[outer], lm[inner], np.array([lm[lo[0]], lm[lo[1]]])


def _dark_circles(c: Ctx, ly: Layer):
    for o, i, lo in _eye_frames(c):
        w = abs(i[0] - o[0])
        cx = (o[0] + i[0]) / 2
        cy = lo[:, 1].max() + 0.13 * U
        ly.ellipse((cx, cy), (w * 0.62, 0.13 * U), 0, BLUE, alpha=0.5)


def _eye_bags(c: Ctx, ly: Layer):
    for o, i, lo in _eye_frames(c):
        w = abs(i[0] - o[0])
        cx = (o[0] + i[0]) / 2
        cy = lo[:, 1].max() + 0.2 * U
        ly.ellipse((cx, cy), (w * 0.55, 0.11 * U), 0, PURPLE, alpha=0.6)


def _wrinkles(c: Ctx, ly: Layer):
    for r, sig in (("forehead", [1.5, 2.5]), ("crow_l", [1, 1.8]), ("crow_r", [1, 1.8]),
                   ("undereye_l", [1, 1.5]), ("undereye_r", [1, 1.5])):
        cr, m, (x0, y0) = c.crop(c.L, r)
        if cr.shape[0] < 8 or cr.shape[1] < 8:
            continue
        rid = sato(cr.astype(float), sigmas=sig, black_ridges=True)
        cand = ((rid > 1.2) & m).astype(np.uint8)
        n, lab_cc, st, _ = cv2.connectedComponentsWithStats(cand)
        for i in range(1, n):
            w, h = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
            if max(w, h) >= 10 and max(w, h) / max(1, min(w, h)) >= 2.5:
                full = np.zeros(c.shape[:2], np.uint8)
                full[y0:y0 + cand.shape[0], x0:x0 + cand.shape[1]][lab_cc == i] = 255
                full = cv2.dilate(full, np.ones((2, 2), np.uint8))
                ly.mask(full > 0, CYAN, 0.95, soft=0.6)
    # soft outline of the forehead zone, like a scan region marker
    x0, y0, x1, y1 = c.rg["forehead"]
    ly.line(np.array([[x0, y1], [x0 + (x1 - x0) * 0.1, y0], [x1 - (x1 - x0) * 0.1, y0], [x1, y1]]), WHITE, 1, alpha=0.6)


def _acne(c: Ctx, ly: Layer):
    ra = c.A - cv2.GaussianBlur(c.A, (0, 0), 8)
    for r in ("forehead", "cheek_l", "cheek_r", "chin", "nose"):
        cr, m, (x0, y0) = c.crop(ra, r)
        cand = ((cr > 5) & m).astype(np.uint8)
        n, _, st, cen = cv2.connectedComponentsWithStats(cand)
        for i in range(1, n):
            a_, w, h = st[i, cv2.CC_STAT_AREA], st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
            if 8 <= a_ <= 300 and max(w, h) / max(1, min(w, h)) < 2.5:
                ly.circle((x0 + cen[i][0], y0 + cen[i][1]), max(6, np.sqrt(a_ / np.pi) + 4), RED, 2)


def _oiliness(c: Ctx, ly: Layer):
    base = c.base_L()
    reg = c.region_mask(("forehead", "nose", "chin"))
    ly.mask(reg & (c.L > base + 13), YELLOW, 0.7, soft=1.5)
    for r in ("forehead", "nose", "chin"):
        x0, y0, x1, y1 = c.rg[r]
        ly.line(np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), YELLOW, 1, closed=True, alpha=0.35)


def _moisture(c: Ctx, ly: Layer):
    reg = c.face_region()
    hp = np.abs(c.L - cv2.GaussianBlur(c.L, (0, 0), 1.5))
    ly.heat(hp / 5.0, reg, alpha=0.6, soft=4.0)


def _firmness(c: Ctx, ly: Layer):
    lm = c.lm
    for nose, mouth, sgn in ((31, 48, -1), (35, 54, 1)):
        p0 = lm[nose] + np.array([sgn * 0.02 * U, 0.1 * U])
        p2 = lm[mouth] + np.array([sgn * 0.1 * U, 0.0])
        p1 = (p0 + p2) / 2 + np.array([sgn * 0.08 * U, 0])
        ly.line(_bezier(p0, p1, p2), ORANGE, 3)
    ly.line(lm[3:14], ORANGE, 2, alpha=0.8)


def _radiance(c: Ctx, ly: Layer):
    poly = c.face_poly()
    (cx, cy), (MA, ma), ang = cv2.fitEllipse(poly)
    ly.ellipse((cx, cy), (MA / 2, ma / 2), ang, WHITE, alpha=0.35, th=9)
    ly.ellipse((cx, cy), (MA / 2, ma / 2), ang, WHITE, alpha=0.95, th=2)


def _upper_lid(c: Ctx, ly: Layer):
    lm = c.lm
    for a in (36, 42):
        arc = lm[a:a + 4]
        crease = arc[::-1] + np.array([0, -0.11 * U])
        ly.line(np.vstack([arc, crease]), PINK, 3, closed=True)


def _lower_lid(c: Ctx, ly: Layer):
    lm = c.lm
    for seq in ((36, 41, 40, 39), (45, 46, 47, 42)):
        arc = lm[list(seq)]
        below = arc[::-1] + np.array([0, 0.09 * U])
        ly.line(np.vstack([arc, below]), PINK, 3, closed=True)


def _hollows(c: Ctx, ly: Layer):
    lm = c.lm
    for inner, sgn, lo in ((39, -1, (41, 40)), (42, 1, (46, 47))):
        y = max(lm[lo[0], 1], lm[lo[1], 1])
        p0 = np.array([lm[inner, 0] + sgn * -0.02 * U, y + 0.1 * U])
        p2 = np.array([lm[inner, 0] + sgn * 0.26 * U, y + 0.34 * U])
        p1 = np.array([lm[inner, 0] + sgn * 0.02 * U, y + 0.3 * U])
        ly.line(_bezier(p0, p1, p2), YELLOW, 3)


PAINTERS = {
    "spots": _spots, "pores": _pores, "texture": _texture, "redness": _redness,
    "dark_circles": _dark_circles, "wrinkles": _wrinkles, "acne": _acne, "oiliness": _oiliness,
    "moisture": _moisture, "firmness": _firmness, "radiance": _radiance, "eye_bags": _eye_bags,
    "upper_eyelid_droopiness": _upper_lid, "lower_eyelid_droopiness": _lower_lid,
    "under_eye_hollows": _hollows,
}


def _compose(orig: np.ndarray, ly: Layer, M: np.ndarray) -> np.ndarray:
    h, w = orig.shape[:2]
    flags = cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP
    rgb = cv2.warpAffine(ly.rgb, M, (w, h), flags=flags, borderValue=0).astype(np.float32)
    a = cv2.warpAffine(ly.a, M, (w, h), flags=flags, borderValue=0)[..., None]
    return np.clip(orig.astype(np.float32) * (1 - a) + rgb * a, 0, 255).astype(np.uint8)


def _jpeg_b64(img: np.ndarray, max_side=720, q=80) -> str:
    h, w = img.shape[:2]
    s = min(1.0, max_side / max(h, w))
    if s < 1:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
    return base64.b64encode(buf.tobytes()).decode()


def render_all(analyzer, face, orig: np.ndarray) -> dict[str, str]:
    """{metric_key: base64 JPEG} - the photo with that metric's mask drawn on it."""
    ctx = Ctx(analyzer, face)
    out = {}
    for m in METRICS:
        ly = Layer(ctx.shape)
        try:
            PAINTERS[m](ctx, ly)
        except Exception:  # an overlay must never break the scan
            pass
        out[m] = _jpeg_b64(_compose(orig, ly, face.M))
    return out
