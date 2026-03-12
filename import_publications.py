"""
Bulk import publications from docx into data/publications.js
Usage: python import_publications.py
"""
import re
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document

DOCX_PATH = r'C:\Users\joech\OneDrive\바탕 화면\KENTECH 조채익\2026년\0. 클로드 코드 작업용\Achievement summary_251226_for claude code_raw data.docx'
OUT_PATH = r'C:\Claude Code_KENTECH\data\publications.js'

# ── DOI / image lookup from existing publications.js ────────────────────────
# These are manually verified entries we want to preserve
EXISTING_LOOKUP = {
    "photo-assisted technologies for environmental remediation":
        {"doi": "https://doi.org/10.1038/s44359-025-00037-1"},
    "role of the tio2 crystalline phase in pt-tio2 for thermocatalytic mineralization of gaseous acetaldehyde":
        {"doi": "https://doi.org/10.1021/acsestengg.4c00400"},
    "egg shell mediated ni5p4/polypyrrole electrocatalyst for sustainable water splitting":
        {"doi": "https://doi.org/10.1021/acs.energyfuels.4c04000"},
    "in situ photoelectrochemical chloride activation using wo3 electrode for oxidative treatment with simultaneous h2 evolution under visible light":
        {"doi": "https://doi.org/10.1021/acs.est.9b02541"},
    "dual functional photocatalytic and photoelectrocatalytic systems for energy and resource-recovering water treatment":
        {"doi": "https://doi.org/10.1021/acscatal.8b03521"},
    "visible light sensitization of tio2 nanoparticles by a dietary pigment, curcumin, for environmental photochemical transformations":
        {"doi": "https://pubs.rsc.org/en/content/articlehtml/2017/ra/c7ra05276f",
         "image": "https://raw.githubusercontent.com/joechaeik/epa-homepage/main/images/publications/1773213475987_Visible_light_sensitization_of_TiO2_nanoparticles_by_a_dietary_pigment%2C_curcumin%2C_for_environmental_photochemical_transformations.gif"},
}

# ── Parsing helpers ──────────────────────────────────────────────────────────

def clean_text(t):
    """Normalize whitespace and remove trailing junk."""
    t = t.replace('\u202f', ' ').replace('\u00a0', ' ')
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def is_section_header(t):
    headers = [
        r'^summary of accomplishments',
        r'^publications in',
        r'^non-scie',
        r'^\*\[',
        r'^\[\d+\]\s*\*?\[',
    ]
    tl = t.lower()
    for h in headers:
        if re.match(h, tl):
            return True
    return len(t) < 40

def parse_pub(raw):
    text = clean_text(raw)

    # ── Extract title (between smart or regular quotes) ──────────────────
    # Try smart quotes first, then regular
    title_re = re.search(r'[\u201c\u00ab"](.{10,400}?)[\u201d\u00bb"]', text)
    if not title_re:
        return None
    title = title_re.group(1).strip().rstrip('.,')

    authors_raw = text[:title_re.start()].strip().rstrip(',').strip()
    after = text[title_re.end():].strip().lstrip(',').strip()

    # ── Extract DOI ──────────────────────────────────────────────────────
    doi = ''
    doi_pats = [
        r'https?://doi\.org/(10\.[^\s\)\];,\u202f]+)',
        r'doi\.org/(10\.[^\s\)\];,\u202f]+)',
        r'[Dd][Oo][Ii]:?\s*(10\.[^\s\)\];,\u202f]+)',
    ]
    for pat in doi_pats:
        m = re.search(pat, after)
        if m:
            doi_val = m.group(1).rstrip('.);\u202f ')
            doi = f'https://doi.org/{doi_val}'
            after = (after[:m.start()] + after[m.end():]).strip()
            break

    # ── Strip trailing noise ─────────────────────────────────────────────
    after = re.sub(r'\s*\*?\[Introduced.*$', '', after, flags=re.I).strip()
    after = re.sub(r'\s*\(doi.*$', '', after, flags=re.I).strip()
    after = re.sub(r'\s*\[\d{4}/\d.*$', '', after).strip()
    after = re.sub(r'\s*\(\d{4}/\d+(?:/\d+)?\)\s*$', '', after).strip()

    # ── Extract year ─────────────────────────────────────────────────────
    year_match = re.search(r'\b((?:19|20)\d{2})\b', after)
    year = int(year_match.group(1)) if year_match else None

    # ── Split into journal vs. vol/pages ─────────────────────────────────
    if year_match:
        journal_raw = after[:year_match.start()].strip().rstrip(', ').strip()
        after_year = after[year_match.end():].strip().lstrip(',; ').rstrip('.,; ')
    else:
        # in press
        journal_raw = re.sub(r'\s*[Ii]n\s+[Pp]ress.*$', '', after).strip().rstrip(', ')
        after_year = ''
        year = None  # keep None, will default to 2025

    journal = journal_raw.strip()

    # ── Build journal_info ────────────────────────────────────────────────
    if after_year:
        # Remove extra date stamps like (2012/5/3) or (2003/10/31)
        after_year = re.sub(r'\s*\(\d{4}/\d+(?:/\d+)?\)\s*$', '', after_year).strip()
        after_year = after_year.strip(' .,;')

        # Pattern A: 102(39), 7618-7630  →  vol=102 pages=7618-7630
        m = re.match(r'^(\d+)\s*\(\d+\)\s*[,;]\s*(.+)$', after_year)
        if m:
            vol, rest = m.group(1), m.group(2).strip().rstrip('.,')
            journal_info = f'{vol} ({year}) {rest}'
        else:
            # Pattern B: vol, pages   or   vol:article   or   vol pages
            m = re.match(r'^(\d+[A-Z]?)\s*[,:\s]+(.+)$', after_year)
            if m:
                vol = m.group(1)
                rest = m.group(2).strip().rstrip('.,')
                journal_info = f'{vol} ({year}) {rest}'
            else:
                # Just an article number / other
                clean = after_year.rstrip('.,')
                journal_info = f'{clean} ({year})' if clean else f'({year})'
    elif year:
        journal_info = f'in press ({year})'
    else:
        journal_info = 'in press'

    # ── Look up existing DOI / image ──────────────────────────────────────
    title_key = title.lower()
    existing = EXISTING_LOOKUP.get(title_key, {})
    if not doi and existing.get('doi'):
        doi = existing['doi']
    image = existing.get('image', '')

    return {
        'year': year if year else 2025,
        'title': title,
        'journal': journal,
        'journal_info': journal_info,
        'authors': authors_raw,
        'doi': doi,
        'image': image,
    }

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    doc = Document(DOCX_PATH)
    pubs = []
    skipped = []

    for para in doc.paragraphs:
        raw = para.text.strip()
        if not raw:
            continue
        if is_section_header(raw):
            continue
        result = parse_pub(raw)
        if result:
            pubs.append(result)
        else:
            skipped.append(raw[:80])

    # Sort: newest first
    pubs.sort(key=lambda p: p['year'], reverse=True)

    # Write publications.js
    js = 'var PUBLICATIONS = ' + json.dumps(pubs, ensure_ascii=False, indent=2) + ';\n'
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(js)

    print(f'✅  Wrote {len(pubs)} publications to data/publications.js')
    if skipped:
        print(f'\n⚠️  Skipped {len(skipped)} lines (no title found):')
        for s in skipped:
            print(f'   {s}')

if __name__ == '__main__':
    main()
