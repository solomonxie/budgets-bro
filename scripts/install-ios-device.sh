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

xcrun devicectl device install app --device "$UDID" \
  "$DERIVED/Build/Products/Release-iphoneos/$SCHEME.app"
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID"
