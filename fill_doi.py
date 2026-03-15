"""
Fill DOI column in publications_export.csv using CrossRef API.
- 429 발생 시 지수 백오프로 재시도
- 진행 상황 중간저장 (중단 후 재시작 가능)
- 완료된 행은 건너뜀
"""
import csv, json, time, re, sys, io, os
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import quote_plus
from difflib import SequenceMatcher

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

IN_PATH  = r'C:\Claude Code_KENTECH\publications_export.csv'
OUT_PATH = r'C:\Claude Code_KENTECH\publications_export_doi.csv'

SIMILARITY_THRESHOLD = 0.85
UA = 'DOI-Filler/1.0 (mailto:wchoi@kentech.ac.kr)'

def normalize(t):
    return re.sub(r'\s+', ' ', t.lower().strip())

def title_sim(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def crossref_query(title, year=None):
    q = quote_plus(title)
    url = f'https://api.crossref.org/works?query.title={q}&rows=5&select=DOI,title'
    if year:
        url += f'&filter=from-pub-date:{year},until-pub-date:{year}'
    req = Request(url, headers={'User-Agent': UA})
    retries, wait = 0, 5
    while retries < 5:
        try:
            with urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
            items = data.get('message', {}).get('items', [])
            for item in items:
                candidate = item.get('title', [''])[0]
                sim = title_sim(title, candidate)
                if sim >= SIMILARITY_THRESHOLD:
                    return f"https://doi.org/{item['DOI']}", sim
            return '', 0
        except HTTPError as e:
            if e.code == 429:
                print(f'    ⚠️  429 rate-limit — {wait}s 대기 후 재시도 ({retries+1}/5)...')
                time.sleep(wait)
                wait *= 2
                retries += 1
            else:
                return '', 0
        except Exception:
            return '', 0
    return '', 0

def main():
    # 이전 실행 결과가 있으면 그걸 이어서 사용 (중간저장 활용)
    resume_path = OUT_PATH if os.path.exists(OUT_PATH) else IN_PATH
    with open(resume_path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))

    total  = len(rows)
    filled = 0
    failed = []

    for i, row in enumerate(rows):
        if row['DOI'].strip():
            print(f'[{i+1}/{total}] skip (DOI 있음)')
            continue

        title = row['논문 제목'].strip()
        year  = str(row['연도']).strip()

        doi, sim = crossref_query(title, year)
        if not doi:
            doi, sim = crossref_query(title)   # 연도 필터 없이 재시도

        if doi:
            row['DOI'] = doi
            filled += 1
            print(f'[{i+1}/{total}] ✅ ({sim:.2f}) {title[:70]}')
        else:
            failed.append(title)
            print(f'[{i+1}/{total}] ❌  {title[:70]}')

        # 10건마다 중간저장
        if (i + 1) % 10 == 0:
            _save(rows)
            print(f'    💾 중간저장 완료 ({i+1}/{total})')

        time.sleep(0.25)   # 4 req/s — 안전한 속도

    _save(rows)
    print(f'\n✅  완료. {filled}/{total} DOI 채움.')
    if failed:
        print(f'❌  DOI 없는 항목 ({len(failed)}개):')
        for t in failed[:20]:
            print(f'   {t[:80]}')
        if len(failed) > 20:
            print(f'   ... 외 {len(failed)-20}개')

def _save(rows):
    fieldnames = ['연도', '저널 약어', '논문 제목', '저자', '저널 상세', 'DOI']
    with open(OUT_PATH, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

if __name__ == '__main__':
    main()
