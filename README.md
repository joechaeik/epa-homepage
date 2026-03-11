# EPA Lab @ KENTECH

**Eco-friendly Photoenergy Application Laboratory**
Department of Energy Engineering, KENTECH Institute for Environmental and Climate Technology

---

## 🚀 개발 서버 실행

```bash
# Python
python -m http.server 3000
# 브라우저에서 http://localhost:3000 열기
```

---

## 📝 콘텐츠 업데이트 방법

### 논문 추가 (`data/publications.js`)
```js
{
  year: 2025,
  title: "논문 제목",
  journal: "저널명",
  journal_info: "연도, 권(호), 페이지",
  authors: "저자1, 저자2, Wonyong Choi*",
  doi: "https://doi.org/...",
  image: "images/pubs/파일명.jpg",  // 생략 가능
},
```

### 뉴스 추가 (`data/news.js`)
```js
{
  id: 68,
  date: "2026-03-10",
  title: "뉴스 제목",
  category: "Award",  // Award | Honor | Research
  link: "#",
  pinned: true,  // 홈에 고정 표시 (선택)
},
```

### 멤버 추가 (`data/members.js`)
`MEMBERS.students` 배열에 항목 추가.

### 갤러리 사진 추가 (`gallery.html` 내 GALLERY 배열)
1. `images/gallery/` 폴더에 사진 파일 넣기
2. `gallery.html`의 `GALLERY` 배열에 항목 추가

---

## 🌐 GitHub Pages 배포

1. GitHub에 새 리포지토리 생성
2. 이 폴더 전체를 push
3. Settings → Pages → Source: `main` 브랜치 루트 선택
4. `https://username.github.io/repo-name/` 에서 확인

---

## 📁 프로젝트 구조

```
├── index.html          # 홈
├── research.html       # 연구
├── members.html        # 멤버
├── publications.html   # 논문
├── news.html           # 뉴스 & 미디어
├── gallery.html        # 사진
├── assets/
│   ├── css/style.css   # 디자인 시스템
│   └── js/main.js      # 공통 JS
├── data/
│   ├── publications.js # 논문 데이터
│   ├── members.js      # 멤버 데이터
│   ├── news.js         # 뉴스 데이터
│   └── research.js     # 연구 데이터
└── images/             # 이미지 파일
    ├── members/        # 멤버 사진
    ├── pubs/           # 논문 그래픽 이미지
    └── gallery/        # 갤러리 사진
```
