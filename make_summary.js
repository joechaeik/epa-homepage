const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
  LevelFormat, PageNumber, Header, Footer, ExternalHyperlink
} = require('docx');
const fs = require('fs');

// ── helpers ──────────────────────────────────────────────────────────────────
const FONT = 'Arial';
const BLUE = '1F6FEB';
const DARK = '24292F';
const GRAY = '888888';
const GREEN = '1A7F37';
const ORANGE = 'D4430F';
const LIGHT_BG = 'F6F8FA';
const BORDER_COLOR = 'DDDDDD';

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, ...opts });
}

function para(children, opts = {}) {
  const kids = typeof children === 'string'
    ? [run(children)]
    : Array.isArray(children) ? children : [children];
  return new Paragraph({ children: kids, ...opts });
}

function heading1(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, bold: true, color: DARK, size: 32 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
    spacing: { before: 320, after: 160 },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, bold: true, color: BLUE, size: 24 })],
    spacing: { before: 240, after: 80 },
  });
}

function infoTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            borders, width: { size: 2400, type: WidthType.DXA },
            shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [para([run(label, { bold: true, size: 20 })]) ]
          }),
          new TableCell({
            borders, width: { size: 6960, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [para([run(value, { size: 20 })]) ]
          })
        ]
      })
    )
  });
}

function statusTable(rows, colWidths) {
  const [w1, w2, w3, w4] = colWidths;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((cells, ri) =>
      new TableRow({
        children: cells.map((cell, ci) => {
          const isHeader = ri === 0;
          const fill = isHeader ? '2C3E50' : (ri % 2 === 0 ? 'FFFFFF' : LIGHT_BG);
          const textColor = isHeader ? 'FFFFFF' : DARK;
          return new TableCell({
            borders,
            width: { size: colWidths[ci], type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [para([run(cell, { size: 18, bold: isHeader, color: textColor })])]
          });
        })
      })
    )
  });
}

function bulletItem(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [run(text, { size: 20, ...opts })],
    spacing: { after: 40 }
  });
}

function subBullet(text) {
  return new Paragraph({
    numbering: { reference: 'subbullets', level: 0 },
    children: [run(text, { size: 18, color: '555555' })],
    spacing: { after: 40 }
  });
}

function spacer(before = 0, after = 120) {
  return para([run('')], { spacing: { before, after } });
}

function badge(text, color) {
  return new TextRun({ text: ` [${text}] `, font: FONT, color, bold: true, size: 18 });
}

// ── document ─────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } }
        }]
      },
      {
        reference: 'subbullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '–',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1000, hanging: 280 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            run('EPA Lab KENTECH  |  Homepage 개발 작업 요약', { size: 16, color: '999999' }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' } },
          spacing: { after: 0 }
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            run('EPA Lab KENTECH @ github.com/joechaeik/epa-homepage', { size: 16, color: '999999' }),
            new TextRun({ children: ['\t', PageNumber.CURRENT], font: FONT, size: 16, color: '999999' }),
          ],
          tabStops: [{ type: 'right', position: 9360 }],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' } },
        })]
      })
    },
    children: [
      // ── COVER ──
      para([run('EPA Lab KENTECH', { bold: true, size: 48, color: DARK })],
        { alignment: AlignmentType.CENTER, spacing: { before: 480, after: 120 } }),
      para([run('Homepage 개발 작업 전체 요약', { size: 32, color: BLUE })],
        { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 } }),
      para([run('2026년 3월 11일 ~ 3월 16일 | Claude Code 작업 기록', { size: 22, color: GRAY })],
        { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 480 } }),

      // ── 1. 세션 개요 ──
      heading1('1. 프로젝트 개요'),
      infoTable([
        ['프로젝트', 'EPA Lab KENTECH 홈페이지 (GitHub Pages)'],
        ['저장소', 'github.com/joechaeik/epa-homepage'],
        ['기술 스택', 'React (frontend), Node.js (backend), GitHub API'],
        ['호스팅', 'GitHub Pages (무료)'],
        ['어드민 패널', '브라우저 기반, GitHub API로 파일 읽기/쓰기'],
        ['작업 기간', '2026-03-11 ~ 2026-03-16'],
        ['총 커밋 수', '약 110개'],
      ]),
      spacer(240),

      // ── 2. 세션 1 ──
      heading1('2. 세션 1 (2026-03-11): 초기 릴리즈 및 기본 기능 개발'),

      heading2('2-1. 홈페이지 초기 릴리즈'),
      bulletItem('React 기반 EPA Lab 홈페이지 최초 배포 (GitHub Pages)'),
      bulletItem('섹션 구성: Home, Members, Research, Publications, Gallery, News, Contact'),
      spacer(0, 80),

      heading2('2-2. Admin 패널 개발'),
      bulletItem('브라우저 기반 어드민 패널 신설 (admin/admin.html, admin/admin.js, admin/admin.css)'),
      bulletItem('GitHub API를 이용한 데이터 파일 읽기/쓰기 구현'),
      bulletItem('Publications, Members 폼에 파일 업로드 기능 추가'),
      spacer(0, 80),

      heading2('2-3. 콘텐츠 및 기능 업데이트'),
      bulletItem('연락처(Contact) 정보 수정: 주소 갱신, 전화번호 삭제, 이메일 수정'),
      bulletItem('뉴스(News) 카테고리 탭 클릭 후 콘텐츠 미표시 버그 수정'),
      bulletItem('뉴스 상세 페이지 추가 및 어드민 편집 기능 연동'),
      bulletItem('이미지 업로드 5MB 제한 및 즉시 UI 피드백 구현'),
      bulletItem('Media 항목 업데이트: 광촉매, 친환경 에너지 시대를 열다'),
      bulletItem('뉴스 업데이트: CO₂ 포집/전환 전극 기술 기사 등록'),
      bulletItem('Gallery 페이지 힌트 박스 제거'),
      bulletItem('Gallery에 EPA Lab Dinner 그룹 사진 추가'),
      bulletItem('교수님(Wonyong Choi) 프로필 정보 업데이트'),
      spacer(0, 80),

      heading2('2-4. Alumni 필터 기능 추가'),
      bulletItem('Alumni 섹션에 Ph.D. / M.S. 필터 탭 추가'),
      bulletItem('어드민 Alumni 폼 필드 수정 (degree 필드 연동)'),
      spacer(240),

      // ── 3. 세션 2 ──
      heading1('3. 세션 2 (2026-03-12): 기능 고도화 및 대규모 콘텐츠 작업'),

      heading2('3-1. Publications 기능 개선'),
      bulletItem('Publications 페이지에 페이지네이션, 페이지당 표시 수 선택, 연도 고정 헤더 추가'),
      bulletItem('논문 제목 입력 필드에 위첨자(superscript) / 아래첨자(subscript) 툴바 추가'),
      bulletItem('버튼 라벨을 기호(A²) 표기에서 한글(위첨자/아래 첨자)로 변경'),
      bulletItem('홈페이지 Publications 섹션이 연도 변경 후 반영 안 되는 버그 수정'),
      bulletItem('논문 추가: Visible light sensitization of TiO₂ nanoparticles (curcumin 연구)'),
      spacer(0, 80),

      heading2('3-2. Gallery 기능 개선 및 대규모 사진 추가'),
      bulletItem('Gallery 어드민에 드래그앤드롭 정렬 기능 추가'),
      bulletItem('SHA 불일치(409 오류) 버그 수정: ghFetch()에 cache: "no-store" 옵션 적용'),
      bulletItem('어드민 로딩 고착 버그 수정: Cache-Control 요청 헤더 제거 (CORS preflight 방지)'),
      bulletItem('Gallery 탭(All/Group) 클릭 시 이미지 사라지는 버그 수정'),
      bulletItem('그룹 사진 추가: 240207, 240430 group photo'),
      spacer(0, 80),

      para([run('신규 갤러리 이벤트 추가 목록:', { bold: true, size: 20 })],
        { spacing: { before: 80, after: 40 } }),
      statusTable([
        ['이벤트', '분류', '연도'],
        ['2025 EPA Lab Seminar (Day 1, 2, 3)', 'Seminar', '2025'],
        ['2025 Group Photo (Cafe Madang)', 'Group', '2025'],
        ['2025 Teachers\' Day', 'Event', '2025'],
        ['EPA Summer Retreat', 'Event', '2025'],
        ['2024 7th Korea Toray S&T Award', 'Award', '2024'],
        ['2024 Teachers\' Day', 'Event', '2024'],
        ['2023 Teachers\' Day', 'Event', '2023'],
        ['2022 Korean Society of PhotoScience', 'Conference', '2022'],
        ['2022 EPA Workshop in Yeosu', 'Workshop', '2022'],
        ['2022 Group Photo', 'Group', '2022'],
        ['2022 Teacher\'s Day', 'Event', '2022'],
        ['2020 EPA Dinner', 'Event', '2020'],
        ['2020 Doosan Yonkang Environment Award', 'Award', '2020'],
        ['2019 EPA Workshop Group Photo', 'Workshop', '2019'],
        ['3rd Seminar NSFC-NRF Joint Project (x3)', 'Seminar', '2019'],
        ['W. Choi\'s 20th Anniversary / Homecoming Day', 'Event', '-'],
        ['ICP 2015 Conference', 'Conference', '2015'],
      ], [5200, 2480, 1680]),
      spacer(160),

      heading2('3-3. Publications/News/Members 드래그앤드롭 정렬'),
      bulletItem('Publications, News, Members 어드민 탭 전체에 드래그앤드롭 정렬 기능 확장'),
      spacer(0, 80),

      heading2('3-4. 교수 CV 업로드 및 다운로드 버튼'),
      bulletItem('어드민 Members 폼에 CV 파일 업로드 기능 추가 (영문 / 한국어 각각)'),
      bulletItem('Members 페이지 교수 프로필에 CV 다운로드 버튼 표시'),
      bulletItem('CV 파일 업로드: CV(Choi)_KENTECH_250321.pdf, 최원용_이력서_250321.pdf'),
      spacer(0, 80),

      heading2('3-5. 논문 대량 임포트 및 DOI 추가'),
      bulletItem('Word 문서(docx)에서 논문 388편 파싱 → JSON 변환 → 일괄 임포트 (1990~2025)'),
      bulletItem('Python 스크립트로 DOI 자동 매칭 → 382편에 DOI URL 추가'),
      bulletItem('Publications 데이터 파일(data/publications.js) 대규모 갱신'),
      spacer(0, 80),

      heading2('3-6. 멤버 및 뉴스 콘텐츠 업데이트'),
      bulletItem('멤버 추가: Sunil Paul Mathew M.'),
      bulletItem('멤버 업데이트: Bupmo Kim (사진 교체, 정보 수정)'),
      bulletItem('교수 프로필 사진 업데이트: Wonyong Choi'),
      bulletItem('뉴스 추가/업데이트: Highly Cited Researcher 2023/2024, 도레이과학진흥재단 과학기술상, 현대건설 기술공모전 장려상, Best Poster award (Bupmo Kim)'),
      bulletItem('뉴스 데이터 캐시 버그 수정: data/news.js를 fetch no-store로 로드'),
      para([run('논문 업데이트: ', { bold: true, size: 20 }), run('Integrated Capture and Conversion of Dilute CO₂ 외', { size: 20 })],
        { spacing: { before: 40, after: 40 }, numbering: { reference: 'bullets', level: 0 } }),
      spacer(0, 80),

      heading2('3-7. Alumni Visitor 필터 탭 추가'),
      bulletItem('Alumni 섹션에 Visitor 카테고리 필터 탭 추가'),
      bulletItem('어드민 Alumni 폼 degree 필드에 Visitor 옵션 추가'),
      spacer(240),

      // ── 4. 기술 이슈 ──
      heading1('4. 주요 기술 이슈 및 해결 내역'),
      infoTable([
        ['이슈 1', 'Gallery 저장 시 SHA 409 불일치 오류'],
        ['원인', 'GitHub API 파일 쓰기 시 SHA 값 필요 → 브라우저 캐시로 stale SHA 사용'],
        ['해결', 'ghFetch()의 fetch 옵션에 cache: "no-store" 추가'],
        ['이슈 2', '어드민 패널 로딩 고착 (무한 스피너)'],
        ['원인', 'Cache-Control 요청 헤더 → CORS preflight 유발 → GitHub API 거부'],
        ['해결', 'Cache-Control 헤더 제거, cache 옵션(fetch API 표준)으로 대체'],
        ['이슈 3', 'Gallery 탭 전환 시 이미지 사라짐'],
        ['원인', '필터 상태 초기화 로직 버그'],
        ['해결', '필터 탭 클릭 핸들러 로직 수정'],
        ['이슈 4', 'Publications 홈페이지 연도 변경 미반영'],
        ['원인', '어드민 저장 후 데이터 재로드 미처리'],
        ['해결', '저장 완료 후 publications 데이터 재fetch 처리'],
      ]),
      spacer(240),

      // ── 5. 미커밋 작업 ──
      heading1('5. 커밋되지 않은 작업물 (로컬 파일)'),
      para('아래 파일들은 작업 디렉토리에 존재하나 Git에 추가되지 않은 상태입니다.',
        { spacing: { before: 40, after: 80 } }),
      statusTable([
        ['파일명', '용도'],
        ['apply_doi.py', '논문 DOI 자동 매칭 및 적용 Python 스크립트'],
        ['export_publications_csv.py', '논문 데이터를 CSV로 내보내기'],
        ['fill_doi.py', 'DOI 값 채우기 보조 스크립트'],
        ['extract_img.py / extract_img2.py', 'docx 이미지 추출 스크립트'],
        ['publications_export.csv', '논문 데이터 내보내기 결과물'],
        ['publications_export_doi.csv', 'DOI 포함 논문 데이터 CSV'],
        ['publications-images/', '논문 관련 이미지 디렉토리'],
      ], [3600, 5760]),
      spacer(240),

      // ── 6. 도메인/호스팅 전략 자문 ──
      heading1('6. 도메인 및 호스팅 전략 자문 (2026-03-16)'),
      para('본 세션(3월 16일)에서는 현재 GitHub Pages 기반 홈페이지를 epa.kentech.ac.kr 도메인으로 전환하는 방안 및 서버 운영 가능성에 대한 기술 자문을 진행하였습니다.',
        { spacing: { before: 40, after: 120 } }),

      heading2('6-1. 현재 상황'),
      bulletItem('기존 홈페이지: 외주업체 "디자인다쏘" 연 100만원 유지관리'),
      bulletItem('신규 홈페이지: GitHub Pages 무료 호스팅 (joechaeik.github.io/epa-homepage)'),
      bulletItem('목표 도메인: epa.kentech.ac.kr (KENTECH 서브도메인)'),
      spacer(0, 80),

      heading2('6-2. 도메인 연결 방안 분석'),
      statusTable([
        ['방안', '비용', '난이도', '권장'],
        ['① GitHub Pages + DNS CNAME', '0원', '낮음 ★☆☆', '1순위'],
        ['② 클라우드 VPS + 도메인', '연 6~18만원', '중간 ★★☆', '2순위'],
        ['③ 미니PC 서버', '전기세 외 0원', '높음 ★★★', '조건부'],
        ['④ Redirect (임시)', '0원', '매우 낮음', '비권장'],
      ], [3000, 2000, 2360, 2000]),
      spacer(80),

      heading2('6-3. 핵심 확인 사항'),
      bulletItem('epa.kentech.ac.kr 도메인의 DNS 변경 권한 주체 확인 필요'),
      subBullet('디자인다쏘가 보유한 경우: 계약 종료 후 이전 요청'),
      subBullet('학교 IT팀이 보유한 경우: IT팀에 CNAME 레코드 추가 요청'),
      bulletItem('미니PC 서버 운영 시 교내 네트워크 외부 포트(80/443) 개방 필요 → IT팀 협조 필요'),
      spacer(0, 80),

      heading2('6-4. 권장 전환 절차'),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [run('디자인다쏘에 DNS 변경 권한 여부 문의', { size: 20 })],
        spacing: { after: 40 }
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [run('DNS CNAME 레코드 변경: epa.kentech.ac.kr → joechaeik.github.io', { size: 20 })],
        spacing: { after: 40 }
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [run('GitHub Pages 설정에서 Custom domain을 epa.kentech.ac.kr 로 지정', { size: 20 })],
        spacing: { after: 40 }
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [run('디자인다쏘 계약 해지 → 연 100만원 절감', { size: 20, color: GREEN, bold: true })],
        spacing: { after: 40 }
      }),
      spacer(240),

      // ── 7. 현재 상태 ──
      heading1('7. 현재 상태 요약'),
      statusTable([
        ['항목', '상태', '비고'],
        ['홈페이지 공개', '운영 중', 'GitHub Pages'],
        ['어드민 패널', '정상 동작', 'SHA/CORS 버그 해결 완료'],
        ['논문 데이터', '388편 등록', 'DOI 382편 적용'],
        ['갤러리', '20+ 이벤트', '드래그앤드롭 정렬 가능'],
        ['멤버 데이터', '최신화 완료', 'CV 다운로드 포함'],
        ['뉴스 데이터', '최신화 완료', '상세 페이지 포함'],
        ['도메인 전환', '미완료', '디자인다쏘/IT팀 협의 필요'],
      ], [3200, 2160, 4000]),
      spacer(240),

      // ── 8. 향후 과제 ──
      heading1('8. 향후 과제'),
      bulletItem('도메인 전환: epa.kentech.ac.kr DNS CNAME 설정'),
      bulletItem('디자인다쏘 계약 종료 처리'),
      bulletItem('어드민 접근 비밀번호 보호 레이어 추가 (보안 강화)'),
      bulletItem('Python 스크립트 파일 정리 및 필요 시 Git 커밋'),
      bulletItem('정기적 콘텐츠 업데이트: 연구 성과, 멤버 변동, 뉴스'),
      spacer(0, 120),

      // ── end spacer ──
      para([run('')], { spacing: { before: 480 } }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('EPA_Lab_작업요약_20260316.docx', buf);
  console.log('Done: EPA_Lab_작업요약_20260316.docx');
});
