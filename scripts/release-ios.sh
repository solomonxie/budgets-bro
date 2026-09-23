#!/bin/sh
# Archive a Release build and upload it to App Store Connect in one go.
# Needs: Xcode → Settings → Accounts signed in to the developer Apple ID.
# Build number is a timestamp so every upload is higher than the last;
# the user-visible version is MARKETING_VERSION in project.pbxproj.
#
# Usage: scripts/release-ios.sh [build-number]
set -e
cd "$(dirname "$0")/.."

SCHEME=BudgetsBro
BUILD=${1:-$(date +%Y%m%d%H%M)}
ARCHIVE=/tmp/budgetsbro-release/$SCHEME-$BUILD.xcarchive

xcodebuild -workspace "ios/$SCHEME.xcworkspace" -scheme "$SCHEME" \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD" archive

xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath /tmp/budgetsbro-release/export -allowProvisioningUpdates

echo "Uploaded build $BUILD. Processing in App Store Connect takes 15–60 min."
