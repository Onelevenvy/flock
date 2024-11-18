#!/usr/bin/env python3
import sys
try:
    import numpy
    import pandas
    print("Health check passed")
    sys.exit(0)
except Exception as e:
    print(f"Health check failed: {e}")
    sys.exit(1) 