#!/bin/sh
#
# Xcode Cloud post-clone hook.
#
# WHY THIS EXISTS
#
# Xcode Cloud clones the repository and runs xcodebuild directly. It never
# runs npm. But ios/App/CapApp-SPM/Package.swift references the Capacitor
# plugins by relative path into node_modules/, and node_modules/ is
# gitignored — so without this script SPM cannot resolve and the build dies
# before compiling anything:
#
#   Could not resolve package dependencies: the package at
#   '/Volumes/workspace/repository/node_modules/@capacitor/status-bar'
#   cannot be accessed (... doesn't exist in file system)
#
# So: install Node, restore node_modules, rebuild the web bundle, and sync it
# into the committed iOS shell — all before xcodebuild runs.
#
# See docs/NATIVE.md. This is the Xcode Cloud equivalent of the "Install
# dependencies" + "Build the web bundle" + "Generate the iOS shell" steps
# that codemagic.yaml performs for Codemagic.

set -e

# Node is pinned to the version the build was verified against, rather than
# `brew install node`, which is slower and drifts. Xcode Cloud runs on Apple
# silicon, but detect anyway so this stays correct if that ever changes.
NODE_VERSION=22.22.3

case "$(uname -m)" in
	arm64)  NODE_ARCH=darwin-arm64 ;;
	x86_64) NODE_ARCH=darwin-x64 ;;
	*)      echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# CI_PRIMARY_REPOSITORY_PATH is set by Xcode Cloud. The fallback lets this
# script be run by hand from a checkout for debugging.
REPO="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO"

echo "==> repository: $REPO"

if command -v node >/dev/null 2>&1; then
	echo "==> node already present: $(node -v)"
else
	echo "==> installing node v$NODE_VERSION ($NODE_ARCH)"
	curl -fsSL -o /tmp/node.tar.xz \
		"https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_ARCH.tar.xz"
	mkdir -p "$HOME/.local"
	tar -xJf /tmp/node.tar.xz -C "$HOME/.local"
	rm -rf "$HOME/.local/node"
	mv "$HOME/.local/node-v$NODE_VERSION-$NODE_ARCH" "$HOME/.local/node"
	PATH="$HOME/.local/node/bin:$PATH"
	export PATH
fi

echo "==> node $(node -v), npm $(npm -v)"

# Xcode Cloud kills the post-clone script after 15 minutes with no output on
# stdout/stderr. Capping sockets keeps npm's progress reporting flowing rather
# than going quiet during a large parallel fetch.
npm config set maxsockets 3

echo "==> npm ci"
npm ci --foreground-scripts

echo "==> building the web bundle"
# Capacitor ships whatever is in dist/, so this must precede cap sync.
npm run build

# ios/ is committed (it carries the hand-edited AdMob GADApplicationIdentifier
# in Info.plist), so this should never fire. Kept as a guard.
if [ ! -d ios ]; then
	echo "==> ios/ missing, regenerating"
	npx cap add ios --packagemanager SPM
fi

echo "==> cap sync ios"
npx cap sync ios

echo "==> post-clone complete"
