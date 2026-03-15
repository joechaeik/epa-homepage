"""
Apply DOIs from publications_export_doi.csv into data/publications.js
Matches by normalized title.
"""
import csv, json, re, sys, io
from difflib import SequenceMatcher

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CSV_PATH = r'C:\Claude Code_KENTECH\publications_export_doi.csv'
JS_PATH  = r'C:\Claude Code_KENTECH\data\publications.js'

def normalize(t):
    return re.sub(r'\s+', ' ', t.lower().strip())

# 1. CSV에서 title→DOI 매핑 로드
doi_map = {}
with open(CSV_PATH, encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        doi = row['DOI'].strip()
        if doi:
            doi_map[normalize(row['논문 제목'])] = doi

print(f'CSV에서 DOI {len(doi_map)}개 로드')

# 2. publications.js 로드
with open(JS_PATH, encoding='utf-8') as f:
    raw = f.read()
raw_json = re.sub(r'^\s*var\s+PUBLICATIONS\s*=\s*', '', raw).rstrip().rstrip(';')
pubs = json.loads(raw_json)

# 3. 매칭 후 DOI 업데이트
updated = 0
for p in pubs:
    if p.get('doi'):          # 이미 DOI 있으면 건너뜀
        continue
    key = normalize(p.get('title', ''))
    if key in doi_map:
        p['doi'] = doi_map[key]
        updated += 1
    else:
        # 유사도 0.92 이상이면 매칭
        best_sim, best_doi = 0, ''
        for csv_title, csv_doi in doi_map.items():
            sim = SequenceMatcher(None, key, csv_title).ratio()
            if sim > best_sim:
                best_sim, best_doi = sim, csv_doi
        if best_sim >= 0.92:
            p['doi'] = best_doi
            updated += 1

print(f'DOI 업데이트: {updated}개')

# 4. publications.js 저장
js_out = 'var PUBLICATIONS = ' + json.dumps(pubs, ensure_ascii=False, indent=2) + ';\n'
with open(JS_PATH, 'w', encoding='utf-8') as f:
    f.write(js_out)

print('✅ data/publications.js 저장 완료')
