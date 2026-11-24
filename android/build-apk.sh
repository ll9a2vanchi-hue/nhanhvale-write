#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK}"
: "${WRITE_KEYSTORE:?Set WRITE_KEYSTORE to the signing keystore}"
: "${WRITE_KEYSTORE_PASSWORD:?Set WRITE_KEYSTORE_PASSWORD}"
tools="$ANDROID_HOME/build-tools/35.0.0"
platform="$ANDROID_HOME/platforms/android-35/android.jar"
out="$(realpath -m "${1:-Write.apk}")"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT

mkdir -p "$temp/gen" "$temp/classes" "$temp/dex"
"$tools/aapt2" compile --dir res -o "$temp/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest AndroidManifest.xml --java "$temp/gen" \
  -o "$temp/package.apk" "$temp/resources.zip"
mapfile -t sources < <(find src "$temp/gen" -name '*.java')
javac --release 8 -classpath "$platform" -d "$temp/classes" "${sources[@]}"
jar cf "$temp/classes.jar" -C "$temp/classes" .
"$tools/d8" --lib "$platform" --min-api 26 --output "$temp/dex" "$temp/classes.jar"
(cd "$temp/dex" && zip -q -0 "$temp/package.apk" classes.dex)
"$tools/zipalign" -f 4 "$temp/package.apk" "$temp/aligned.apk"
"$tools/apksigner" sign --ks "$WRITE_KEYSTORE" --ks-pass env:WRITE_KEYSTORE_PASSWORD \
  --out "$out" "$temp/aligned.apk"
"$tools/apksigner" verify --verbose "$out"
