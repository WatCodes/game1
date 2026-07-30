#!/bin/sh
#
# Xcode Cloud looks for ci_scripts/ either at the repository root or in the
# directory containing the Xcode project — sources disagree and Apple's own
# documentation could not be confirmed at the time this was written. Rather
# than guess, the real script lives at the repository root and this forwards
# to it, so discovery succeeds either way.
#
# If a build log shows this file running, the project-adjacent location is the
# one Xcode Cloud honors, and the root copy can be deleted (keep this one).
# If the root copy runs instead, delete this file. Only one will ever fire.

set -e
exec "$(cd "$(dirname "$0")/../../../ci_scripts" && pwd)/ci_post_clone.sh"
