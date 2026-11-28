#!/bin/sh
# npm run push "message"
set -e
git pull --rebase --autostash -q
node scripts/validate.js
node scripts/build.js
git add -A
git commit -m "${1:-update}"
git push
