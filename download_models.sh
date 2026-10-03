#!/usr/bin/env sh
# Downloads the two face models (already included in this package; run only if missing)
set -e
mkdir -p models
curl -L -o models/yunet.onnx https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
curl -L -o models/lbfmodel.yaml https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml
