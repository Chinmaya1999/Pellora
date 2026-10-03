"""
Measure accuracy and auto-calibrate against YOUR labelled photos.

This is how you reach (and prove) a target accuracy like 70-90%.

1. Collect photos (100+ is good, 300+ is better; mix of ages, skin tones, phones).
2. Have a dermatologist / trained esthetician grade each photo 0-100 CONCERN
   (0 = none, 100 = severe) for each metric. Put them in labels.csv:

     image,spots,pores,texture,redness,dark_circles,wrinkles,acne,oiliness,moisture,firmness,radiance,eye_bags,upper_eyelid_droopiness,lower_eyelid_droopiness,under_eye_hollows
     photos/001.jpg,20,35,30,10,40,15,0,50,30,20,30,25,10,5,20

   (Blank cells are fine - that metric is skipped for that photo.)

3. Run:
     python tools/calibrate.py labels.csv            # report accuracy only
     python tools/calibrate.py labels.csv --fit      # also write fitted calibration.json

Accuracy = % of predictions within +/-15 points of the expert grade
(the same tolerance typically seen between two human graders).
Uses an 80/20 train/test split so the reported number is honest.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.analyzer import BASE, METRICS, AnalysisError, SkinAnalyzer  # noqa: E402

TOL = 15


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("labels")
    ap.add_argument("--fit", action="store_true", help="write fitted calibration.json")
    ap.add_argument("--tol", type=float, default=TOL)
    args = ap.parse_args()

    an = SkinAnalyzer()
    root = os.path.dirname(os.path.abspath(args.labels))
    rows = list(csv.DictReader(open(args.labels)))
    raws, labels, skipped = [], [], 0
    for r in rows:
        img = cv2.imread(os.path.join(root, r["image"]))
        try:
            res = an.analyze(img)
        except AnalysisError as e:
            print(f"skip {r['image']}: {e.code}"); skipped += 1; continue
        raws.append({m: res["metrics"][m]["raw"] for m in METRICS})
        labels.append({m: float(r[m]) for m in METRICS if r.get(m, "").strip() != ""})
    n = len(raws)
    print(f"\n{n} photos analysed, {skipped} rejected by quality checks\n")
    if n < 10:
        sys.exit("Need at least 10 usable labelled photos.")

    idx = list(range(n)); random.Random(7).shuffle(idx)
    cut = int(0.8 * n); train, test = idx[:cut], idx[cut:]
    calib = json.load(open(os.path.join(BASE, "calibration.json")))
    new_calib = dict(calib)

    print(f"{'metric':26s} {'before':>8s} {'after fit':>10s} {'MAE':>6s} {'corr':>6s}")
    tot_b, tot_a = [], []
    for m in METRICS:
        tr = [(raws[i][m], labels[i][m]) for i in train if m in labels[i]]
        te = [(raws[i][m], labels[i][m]) for i in test if m in labels[i]]
        if len(tr) < 5 or len(te) < 2:
            print(f"{m:26s}  not enough labels"); continue
        x, y = np.array(tr).T
        slope, inter = np.polyfit(x, y, 1)
        xt, yt = np.array(te).T
        before = np.array([an._to_score(m, v) for v in xt])
        after = np.clip(slope * xt + inter, 0, 100)
        acc_b = 100 * np.mean(np.abs(before - yt) <= args.tol)
        acc_a = 100 * np.mean(np.abs(after - yt) <= args.tol)
        corr = np.corrcoef(xt, yt)[0, 1] if np.std(xt) > 0 and np.std(yt) > 0 else float("nan")
        tot_b.append(acc_b); tot_a.append(acc_a)
        print(f"{m:26s} {acc_b:7.0f}% {acc_a:9.0f}% {np.mean(np.abs(after - yt)):6.1f} {corr:6.2f}")
        new_calib[m] = {**calib[m], "linear": [round(float(slope), 4), round(float(inter), 3)]}

    print(f"\nOVERALL accuracy (within ±{args.tol:g}): before {np.mean(tot_b):.0f}%  ->  after fit {np.mean(tot_a):.0f}%")
    print("Low 'corr' (<0.3) means that measurement doesn't track your experts - "
          "rely on use_ai=true for it or improve photo conditions.")
    if args.fit:
        json.dump(new_calib, open(os.path.join(BASE, "calibration.json"), "w"), indent=2)
        print("\nWrote fitted calibration.json - restart the API to use it.")


if __name__ == "__main__":
    main()
