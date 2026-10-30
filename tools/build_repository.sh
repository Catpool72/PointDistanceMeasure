#!/usr/bin/env bash
# PixInsight update repository builder for PointDistanceMeasure.
# Usage: tools/build_repository.sh   (run from the repository root)
# Builds repository/<date>-PointDistanceMeasure.zip and repository/updates.xri
set -euo pipefail

SRC="PointDistanceMeasure_v3_2.js"          # source script (update when a new version arrives)
NAME="PointDistanceMeasure"
VERSION=$(grep -m1 '#define SCRIPT_VERSION' "$SRC" | sed 's/.*"\(.*\)".*/\1/')
DATE=$(date -u +%Y%m%d)
PKG="${DATE}-${NAME}.zip"

rm -rf build && mkdir -p "build/src/scripts/${NAME}"
cp "$SRC" "build/src/scripts/${NAME}/${NAME}.js"
cp README.md README_HU.md "build/src/scripts/${NAME}/" 2>/dev/null || true

rm -f repository/*.zip
(cd build && zip -qrX "../repository/${PKG}" src)
SHA1=$(sha1sum "repository/${PKG}" | cut -d' ' -f1)
rm -rf build

cat > repository/updates.xri <<XRI
<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
   <description>
      <p>Point Distance Measure – PixInsight script repository by Catpool72.</p>
      <p>https://github.com/Catpool72/PointDistanceMeasure</p>
   </description>
   <platform os="all" arch="noarch" version="1.8.9:1.9.9">
      <package fileName="${PKG}" sha1="${SHA1}" type="script" releaseDate="${DATE}">
         <title>Point Distance Measure ${VERSION}</title>
         <description>
            <p>Interactive full-resolution pixel and WCS angular distance measurement with draggable points, live readout and optional star-centroid snapping.</p>
            <p>After installation the script appears under Script &gt; Utilities &gt; PointDistanceMeasure.</p>
         </description>
      </package>
   </platform>
</xri>
XRI
echo "Built ${PKG} (v${VERSION}, sha1 ${SHA1})"
