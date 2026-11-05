#!/usr/bin/env bash
# Regenerates content/seed/*.json from the source files in content/ (Python 3).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/build_vocab.py
python3 content/grammar/build.py
python3 content/uoe/build.py
python3 content/reading/build.py
python3 content/writing/build.py
python3 content/speaking/build.py
