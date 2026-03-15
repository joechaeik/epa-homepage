"""
Export publications from data/publications.js to CSV
Columns: 연도 | 저널 약어 | 논문 제목 | 저자 | 저널 상세 | DOI
"""
import json
import csv
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

JS_PATH = r'C:\Claude Code_KENTECH\data\publications.js'
OUT_PATH = r'C:\Claude Code_KENTECH\publications_export.csv'

# Strip "var PUBLICATIONS = " prefix and trailing ";"
with open(JS_PATH, encoding='utf-8') as f:
    raw = f.read()
raw = re.sub(r'^\s*var\s+PUBLICATIONS\s*=\s*', '', raw).rstrip().rstrip(';')
pubs = json.loads(raw)

with open(OUT_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['연도', '저널 약어', '논문 제목', '저자', '저널 상세', 'DOI'])
    for p in pubs:
        writer.writerow([
            p.get('year', ''),
            p.get('journal', ''),
            p.get('title', ''),
            p.get('authors', ''),
            p.get('journal_info', ''),
            '',  # DOI blank per user request
        ])

print(f'✅  Wrote {len(pubs)} rows to publications_export.csv')
