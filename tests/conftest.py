"""
@file        conftest.py
@description Root-Konfiguration fuer alle Testebenen (test:unit,
             test:integration, test:e2e). Enthaelt bewusst KEINEN
             Playwright-Import mehr (TARA-0112), damit test:unit ohne
             installiertes Playwright-Paket lauffaehig bleibt.
             Die Playwright-/App-Fixtures (app, page, browser_context_args
             etc.) liegen ausschliesslich in tests/e2e/conftest.py und
             werden von pytest automatisch nur fuer Tests unterhalb von
             tests/e2e/ geladen.
@author      Nico Peper
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0
"""

# Prevent pytest from collecting non-Python files matching test_* patterns
collect_ignore_glob = ["*.txt", "*.html", "*.json", "*.bat"]
