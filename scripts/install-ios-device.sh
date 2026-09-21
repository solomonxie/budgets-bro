#!/bin/sh
# Release build straight onto a plugged-in iPhone: xcodebuild signs and builds,
# devicectl installs and launches. Release bundles the JS into the app, so
# nothing here depends on a dev server being up.
#
# Usage: scripts/install-ios-device.sh [udid]
set -e
cd "$(dirname "$0")/.."

SCHEME=BudgetsBro
BUNDLE_ID=com.solomonxie.budgetsbro
DERIVED=${DERIVED_DATA:-/tmp/budgetsbro-device}

# A paired phone reads "connected" while attached and "available (paired)" once
# it has settled — either will take a build, only "unavailable" won't.
UDID=${1:-$(xcrun devicectl list devices |
  awk '/physical/ && !/unavailable/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i }' |
  head -1)}
[ -n "$UDID" ] || { echo "No iPhone reachable — see 'xcrun devicectl list devices'." >&2; exit 1; }

xcodebuild -workspace "ios/$SCHEME.xcworkspace" -scheme "$SCHEME" \
  -configuration Release -destination "id=$UDID" \
  -allowProvisioningUpdates -derivedDataPath "$DERIVED" build

APP="$DERIVED/Build/Products/Release-iphoneos/$SCHEME.app"

# Debug symbols are two thirds of what lands on the phone: 28MB installs as
# 16MB once the app binary and the three embedded frameworks are stripped.
# Stripping invalidates every signature it touches, so each one is signed
# again with the identity the build already used, and the result is only
# installed if it verifies — otherwise the untouched build is.
STRIPPED="$DERIVED/Build/Products/Release-iphoneos/$SCHEME-stripped.app"
IDENTITY=$(codesign -dvv "$APP" 2>&1 | awk -F'= *' '/^Authority=/{print $2; exit}')
if [ -n "$IDENTITY" ]; then
  rm -rf "$STRIPPED"
  cp -R "$APP" "$STRIPPED"
  for framework in "$STRIPPED"/Frameworks/*.framework; do
    [ -d "$framework" ] || continue
    name=$(basename "$framework" .framework)
    strip -rSTx "$framework/$name" 2>/dev/null || true
    codesign --force --preserve-metadata=identifier,entitlements,flags \
      --sign "$IDENTITY" "$framework" >/dev/null 2>&1 || true
  done
  strip -rSTx "$STRIPPED/$SCHEME" 2>/dev/null || true
  codesign --force --preserve-metadata=identifier,entitlements,flags \
    --sign "$IDENTITY" "$STRIPPED" >/dev/null 2>&1 || true
  if codesign --verify --deep --strict "$STRIPPED" >/dev/null 2>&1; then
    APP="$STRIPPED"
    echo "Installing stripped build ($(du -sh "$STRIPPED" | cut -f1))."
  else
    echo "Strip left an invalid signature — installing the unstripped build." >&2
  fi
fi

xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID"
