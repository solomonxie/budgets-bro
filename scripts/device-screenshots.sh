#!/bin/sh
# Store screenshots from the paired iPhone: a SCREENSHOTS build launches
# straight into each demo screen, devicectl captures it, then the normal
# build goes back on. Phone must be unlocked and awake throughout.
# Leaves the app in Demo Mode — turn it off in Settings afterwards.
#
# Usage: scripts/device-screenshots.sh [en|zh] [out-dir]
set -e
cd "$(dirname "$0")/.."

LANG_CODE=${1:-en}
OUT=${2:-/tmp/budgetsbro-shots/$LANG_CODE}
SCHEME=BudgetsBro
BUNDLE_ID=$(sed -n 's/^APP_BUNDLE_ID *= *//p' ios/Local.xcconfig)
DERIVED=/tmp/budgetsbro-shots/derived
SHOTS="01-qbr:qbr 02-prices:prices 03-payee:payee 04-loan:loan 05-house:house 06-insights:insights 07-budgets:budgets 08-settings:settings"

UDID=$(xcrun devicectl list devices |
  awk '/physical/ && !/unavailable/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i }' |
  head -1)
[ -n "$UDID" ] || { echo "No iPhone reachable — see 'xcrun devicectl list devices'." >&2; exit 1; }

xcodebuild -workspace "ios/$SCHEME.xcworkspace" -scheme "$SCHEME" \
  -configuration Release -destination "id=$UDID" \
  -allowProvisioningUpdates -derivedDataPath "$DERIVED" \
  BB_STOREFRONT=CAN SWIFT_ACTIVE_COMPILATION_CONDITIONS='$(inherited) SCREENSHOTS' build
xcrun devicectl device install app --device "$UDID" "$DERIVED/Build/Products/Release-iphoneos/$SCHEME.app"

mkdir -p "$OUT"
for shot in $SHOTS; do
  name=${shot%%:*}
  screen=${shot#*:}
  xcrun devicectl device process launch --device "$UDID" --terminate-existing \
    "$BUNDLE_ID" -screen "$screen" -lang "$LANG_CODE" >/dev/null
  sleep 6
  xcrun devicectl device capture screenshot --device "$UDID" --destination "$OUT/$name.png" >/dev/null
  echo "$name"
done

scripts/install-ios-device.sh "$UDID"
echo "Shots in $OUT. Resize: scripts/store-screenshots.sh $OUT"
