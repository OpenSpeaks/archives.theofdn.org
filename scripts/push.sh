#!/bin/sh
# npm run push "message"
set -e
node scripts/validate.js
node scripts/build.js
git add -A
git commit -m "${1:-update}"
git pull --rebase -q
git push
