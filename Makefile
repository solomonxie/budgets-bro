.PHONY: help check lint ios release screenshots

help:
	@echo "make ios          Release build onto the paired iPhone"
	@echo "make release      check, then archive + upload to App Store Connect"
	@echo "make check        typecheck and tests (release runs this first)"
	@echo "make lint         eslint"
	@echo "make screenshots  SHOTS=<dir>  resize to the App Store slots"

check:
	npx tsc --noEmit
	npx jest

# Not in check yet: BottomSheet and DropdownField still read refs during
# render, which the React Compiler rule flags.
lint:
	npx eslint .

install-ios:
	scripts/install-ios-device.sh

# Uploads whatever is on disk, so say so when that isn't a commit.
release: check
	@git diff --quiet HEAD -- || echo "warning: uncommitted changes are going into this build"
	scripts/release-ios.sh

screenshots:
	scripts/store-screenshots.sh $(SHOTS)
