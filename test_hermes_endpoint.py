#!/usr/bin/env python3
"""Smoke test script for WebLlmBridge Hermes OpenAI-compatible HTTP bridge."""

import urllib.request
import json
import sys

URL = "http://127.0.0.1:17614/v1/models"

print(f"Testing GET {URL} ...")
try:
    with urllib.request.urlopen(URL, timeout=5) as resp:
        data = json.loads(resp.read().decode())
        print("✓ Models Endpoint OK:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Bridge not running or unreachable: {e}")
    print("Start the bridge first via: python3 bridge.py")
    sys.exit(1)
