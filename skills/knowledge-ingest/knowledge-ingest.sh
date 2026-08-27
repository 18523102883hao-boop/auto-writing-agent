#!/bin/bash
# Knowledge Ingest - 便捷入口脚本
# 用法: ./knowledge-ingest.sh <URL> [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/scripts/ingest.py" "$@"
