"""Fix open() calls without encoding='utf-8' in test files."""
import re
import os

TESTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'tests')

files_to_fix = [
    'test_TARA_0004.py',
    'test_TARA_0022.py',
    'test_TARA_0034_0037.py',
]

# Pattern 1: open(simple_var).read()  → already fixed by previous run for test_TARA_0004
PATTERN1 = re.compile(r"open\(([^,)]+)\)\.read\(\)")
REPLACEMENT1 = r"open(\1, encoding='utf-8').read()"

# Pattern 2: open(os.path.join(...)).read()  → two closing )) before .read()
# Replace ")).read()" with "), encoding='utf-8').read()"
PATTERN2 = re.compile(r"\)\)\.read\(\)")
REPLACEMENT2 = r"), encoding='utf-8').read()"

for fname in files_to_fix:
    fpath = os.path.join(TESTS_DIR, fname)
    if not os.path.exists(fpath):
        print(f"SKIP (not found): {fname}")
        continue
    with open(fpath, encoding='utf-8') as f:
        content = f.read()
    orig = content
    content = PATTERN1.sub(REPLACEMENT1, content)
    content = PATTERN2.sub(REPLACEMENT2, content)
    if content != orig:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed encoding in: {fname}")
    else:
        print(f"No changes needed: {fname}")
