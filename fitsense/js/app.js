/** 핏센스 - 앱 스크립트
 *  데이터 연동: data/brands_women.json · items.json · reviews.json · user.json
 *  사용자 저장 데이터: localStorage (계정별)
 */
const KEY = 'fitsense_v2';
const SZ = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PREFS = ['슬림핏', '정핏', '오버핏'];
const PIDX = { '슬림핏': 0, '정핏': 1, '오버핏': 2 };
const PREF_DESC = { '슬림핏': '몸의 라인에 가깝게', '정핏': '적당한 여유로 자연스럽게', '오버핏': '넉넉하고 편안하게' };
const LEGACY_PREF = { '슬림 핏': '슬림핏', '기본 핏': '정핏', '여유 핏': '오버핏' };
// brands_women.json(영문 브랜드명) ↔ items/reviews/user.json(한글 브랜드명)
const ALIAS = { 'UNIQLO': '유니클로', 'ZARA': '자라', 'H&M': 'H&M', 'COS': 'COS', 'SPAO': '스파오', 'TOPTEN10': '탑텐', '8SECONDS': '에잇세컨즈', 'GIORDANO': '지오다노', 'MIXXO': '미쏘', 'MUSINSA STANDARD': '무신사 스탠다드', 'ADIDAS': '아디다스', 'NIKE': '나이키' };
const EN_OF = Object.fromEntries(Object.entries(ALIAS).map(([en, ko]) => [ko, en]));
const MLABEL = { chestCircumference: '가슴둘레', waistCircumference: '허리둘레', hipCircumference: '엉덩이둘레', thighCircumference: '허벅지둘레', shoulderWidth: '어깨너비', backWidth: '등너비', frontLength: '총장', totalLength: '총장', sleeveLength: '소매길이', hemWidth: '밑단너비' };

const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sgn = v => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + 'cm';
const won = n => (n ? Number(n).toLocaleString() + '원' : '가격 정보 없음');
const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

/* ================= 데이터 ================= */
const D = { ready: false, items: [], brands: [], reviews: [], byBrand: {}, prodRev: {} };

async function loadData() {
  try {
    const [items, reviews, user, brands] = await Promise.all(['items', 'reviews', 'user', 'brands_women'].map(n =>
      fetch('data/' + n + '.json').then(r => { if (!r.ok) throw new Error(n + '.json'); return r.json(); })));
    buildData(items, reviews, user.reviews || [], brands.brands || []);
    D.ready = true;
  } catch (e) {
    console.warn('데이터 로딩 오류', e);
    const el = $('data-error');
    el.style.display = 'block';
    el.textContent = 'json 데이터를 불러오지 못했어요. 파일을 더블클릭으로 열면 브라우저가 json 읽기를 막아요. 이 폴더에서 로컬 서버(예: python -m http.server)를 실행한 뒤 접속해 주세요.';
  }
  refreshAll();
}

function buildData(items, reviews, userReviews, brands) {
  // 1) 상품: 여성·공용만 (여성 앱)
  D.items = items.filter(i => i.gender !== '남성').map(i => ({ ...i, revCat: i.category === '원피스/스커트' ? '원피스' : i.category }));
  // 2) 후기: reviews.json(+본문에서 키/몸무게 추출) + user.json(키/몸무게 필드)
  const HW = /(\d{3})\s*cm\D{0,6}?(\d{2,3})\s*kg/;
  D.reviews = [];
  reviews.forEach(r => {
    const m = (r.review_text || '').match(HW); if (!m) return;
    D.reviews.push({ src: 'reviews', pid: r.product_id, brand: r.brand, cat: r.category, h: +m[1], w: +m[2], size: r.purchased_size, fitted: r.fitted_size, matched: !!r.size_matched, score: r.size_score, opinion: r.size_opinion, lenOpinion: r.length_opinion, fit: r.fit_details, rating: r.rating, text: r.review_text, date: r.review_date, id: r.review_id, ease: r.ease_cm });
  });
  userReviews.forEach(r => {
    if (!r.height_cm || !r.weight_kg) return;
    D.reviews.push({ src: 'user', pid: null, brand: r.brand, cat: r.category, h: r.height_cm, w: r.weight_kg, size: r.purchased_size, fitted: r.fitted_size, matched: !!r.size_matched, score: r.size_score, opinion: r.size_opinion, lenOpinion: r.length_opinion, fit: r.fit_details, rating: r.rating, text: r.review_text, date: r.review_date, id: r.review_id, pname: r.product_name });
  });
  D.byBrand = {}; D.reviews.forEach(r => (D.byBrand[r.brand] = D.byBrand[r.brand] || []).push(r));
  // 3) 브랜드: brands_women.json + (items에는 있지만 brands_women에 없는 브랜드)
  D.brands = brands.map(b => ({ id: b.brand_id, ko: ALIAS[b.brand_name] || b.brand_name, en: b.brand_name, website: b.website, cats: (b.categories[0] || {}).medium_categories || null }));
  let nid = 100;
  [...new Set(D.items.map(i => i.brand))].forEach(ko => { if (!D.brands.some(b => b.ko === ko)) D.brands.push({ id: nid++, ko, en: '', website: null, cats: null }); });
  [...new Set(D.reviews.map(r => r.brand))].forEach(ko => { if (!D.brands.some(b => b.ko === ko)) D.brands.push({ id: nid++, ko, en: '', website: null, cats: null }); });
  // 4) 상품 ↔ 후기 연결: (브랜드, 카테고리) 안에서 상품 id 순서대로 reviews.json 의 product_id 에 순환 배정
  const pids = {};
  D.reviews.filter(r => r.pid).forEach(r => { const k = r.brand + '|' + r.cat; (pids[k] = pids[k] || new Set()).add(r.pid); });
  const grp = {};
  D.items.forEach(i => (grp[i.brand + '|' + i.revCat] = grp[i.brand + '|' + i.revCat] || []).push(i));
  Object.entries(grp).forEach(([k, arr]) => {
    const ps = [...(pids[k] || [])].sort(); arr.sort((a, b) => a.id - b.id);
    arr.forEach((it, n) => { it.pid = ps.length ? ps[n % ps.length] : null; });
  });
  D.prodRev = {}; D.reviews.filter(r => r.pid).forEach(r => (D.prodRev[r.pid] = D.prodRev[r.pid] || []).push(r));
}
const itemById = id => D.items.find(i => i.id === +id);
const itemReviews = it => (it && it.pid ? D.prodRev[it.pid] || [] : []);
const brandItems = ko => D.items.filter(i => i.brand === ko);
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function tendency(brand) {
  const rs = (D.byBrand[brand] || []).filter(r => typeof r.score === 'number');
  if (!rs.length) return '경향 정보 없음';
  const a = avg(rs.map(r => r.score));
  return a > 0.25 ? '크게 나오는 편' : a < -0.25 ? '작게 나오는 편' : '정사이즈 경향';
}

/* ---- 추천 ---- */
// 비로그인: "보통 {size} 사이즈를 입던 분들이 이용하는 브랜드"
function recommendBySize(size) {
  const m = {};
  D.reviews.filter(r => r.fitted === size).forEach(r => { const o = (m[r.brand] = m[r.brand] || { n: 0, ok: 0 }); o.n++; if (r.matched) o.ok++; });
  return Object.entries(m).map(([brand, v]) => ({ brand, n: v.n, rate: Math.round(v.ok / v.n * 100) })).sort((a, b) => b.n - a.n || b.rate - a.rate).slice(0, 5);
}
// 로그인: 키·몸무게가 가장 가까운 후기 5건의 fitted_size 로 브랜드별 추천 사이즈 산출
function recommendByBody(h, w) {
  const out = [];
  D.brands.forEach(b => {
    const rs = D.byBrand[b.ko] || []; if (rs.length < 3) return;
    const nb = rs.map(r => ({ r, d: Math.hypot((r.h - h) / 6, (r.w - w) / 5) })).sort((a, c) => a.d - c.d).slice(0, 5);
    const cnt = {}; nb.forEach(x => { cnt[x.r.fitted] = (cnt[x.r.fitted] || 0) + 1 / (1 + x.d); });
    const size = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0];
    const agree = nb.filter(x => x.r.fitted === size).length;
    const close = avg(nb.map(x => 1 / (1 + x.d)));
    out.push({ brand: b.ko, size, agree, n: nb.length, score: .6 * close + .4 * agree / nb.length });
  });
  return out.sort((a, b) => b.score - a.score);
}

/* ================= 상태 / 계정 ================= */
const freshState = () => ({ records: [], brands: [], likedItems: [], recent: [], prof: null, pref: '정핏', usual: '', clothPhotos: [], feedbackPhotos: {}, bodyPhoto: null, flash: '' });
let S = freshState();
let currentUser = localStorage.getItem('fitsense_auth_user') || null;
let authMode = 'login', pendingNext = null;
const isLogged = () => !!currentUser;
const save = () => { if (!currentUser) return; try { localStorage.setItem(KEY + '_' + currentUser, JSON.stringify(S)); } catch (e) { } };
function loadState() {
  S = freshState();
  if (!currentUser) return;
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY + '_' + currentUser) || '{}')); } catch (e) { }
  S.pref = LEGACY_PREF[S.pref] || (PREFS.includes(S.pref) ? S.pref : '정핏');
}
const authUsers = () => { try { return JSON.parse(localStorage.getItem('fitsense_accounts') || '{}'); } catch (e) { return {}; } };

function initializeAuth() { loadState(); applyAuthState(); }
function applyAuthState() {
  $('auth-screen').style.display = 'none'; $('app-shell').style.display = 'flex';
  $('header-username').textContent = isLogged() ? currentUser + '님 ∨' : '로그인';
  $('header-avatar').textContent = isLogged() ? currentUser.slice(0, 1).toUpperCase() : 'G';
}
function headerProfileClick() { isLogged() ? navigateTo('mypage') : showAuth('stay'); }
function requireLogin(next) { if (isLogged()) return true; showAuth(next); return false; }
function showAuth(next) {
  pendingNext = next || null; authMode = 'login'; setAuthTexts();
  $('auth-form').reset(); $('auth-message').textContent = '';
  $('app-shell').style.display = 'none'; $('auth-screen').style.display = 'flex';
}
function closeAuth() { pendingNext = null; $('auth-screen').style.display = 'none'; $('app-shell').style.display = 'flex'; }
function setAuthTexts() {
  const l = authMode === 'login';
  $('auth-title').textContent = l ? '로그인' : '회원가입';
  $('auth-description').textContent = l ? '내 핏 기록을 이어서 확인해 보세요.' : '아이디와 비밀번호만으로 계정을 만들어요.';
  $('auth-submit').textContent = l ? '로그인' : '회원가입';
  $('auth-switch').textContent = l ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인';
  $('auth-password').autocomplete = l ? 'current-password' : 'new-password';
}
function toggleAuthMode() { authMode = authMode === 'login' ? 'signup' : 'login'; setAuthTexts(); $('auth-message').textContent = ''; }
function submitAuth(ev) {
  ev.preventDefault();
  const id = $('auth-id').value.trim(), pw = $('auth-password').value, msg = $('auth-message');
  if (!/^[a-zA-Z0-9_가-힣]{3,24}$/.test(id)) { msg.textContent = '아이디는 3~24자의 한글, 영문, 숫자, 밑줄만 사용할 수 있어요.'; return; }
  const users = authUsers();
  if (authMode === 'signup') {
    if (users[id]) { msg.textContent = '이미 사용 중인 아이디예요.'; return; }
    if (pw.length < 4) { msg.textContent = '비밀번호는 4자 이상 입력해 주세요.'; return; }
    users[id] = pw; localStorage.setItem('fitsense_accounts', JSON.stringify(users)); currentUser = id; S = freshState();
  } else {
    if (!users[id] || users[id] !== pw) { msg.textContent = '아이디 또는 비밀번호를 확인해 주세요.'; return; }
    currentUser = id; loadState();
  }
  localStorage.setItem('fitsense_auth_user', currentUser); save();
  const next = pendingNext; pendingNext = null; applyAuthState(); renderBodyInputs();
  if (typeof next === 'function') { navigateTo('home'); next(); }
  else if (next === 'stay') showPage(page);
  else navigateTo(next || 'home');
  refreshAll();
}
function logoutUser() {
  save(); localStorage.removeItem('fitsense_auth_user'); currentUser = null; S = freshState(); R = { itemId: null, pref: null, view: null, tab: 'viz' };
  applyAuthState(); renderBodyInputs(); navigateTo('home'); refreshAll();
}

/* ================= 라우팅 ================= */
let page = 'home', hist = [], curBrand = null, curItem = null, brandCatFilter = '전체', homeSize = 'M', brandReviewsOpen = false;
function navigateTo(p) {
  if ((p === 'mypage' || p === 'size-input') && !requireLogin(p === 'size-input' ? 'size-input' : 'mypage')) return;
  hist = []; showPage(p);
}
function showPage(p) {
  page = p;
  document.querySelectorAll('.page-section').forEach(x => x.classList.remove('active'));
  const t = $('page-' + p); if (t) t.classList.add('active');
  const tab = (p === 'brand-detail' || p === 'product-detail') ? 'brand' : p;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.target === tab));
  if (p === 'home') renderHome();
  if (p === 'brand') renderBrands();
  if (p === 'brand-detail') renderBrandDetail();
  if (p === 'product-detail') renderProduct();
  if (p === 'mypage') renderMy();
  const b = document.querySelector('.app-body'); if (b) b.scrollTop = 0;
}
function goBack() { showPage(hist.pop() || 'brand'); }
function refreshAll() { renderHome(); if (page !== 'home') showPageNoScroll(); updateStepTabs(); }
function showPageNoScroll() {
  if (page === 'brand') renderBrands(); if (page === 'brand-detail') renderBrandDetail(); if (page === 'product-detail') renderProduct(); if (page === 'mypage') renderMy();
}
function openModal(id) { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

/* ================= 신체 입력 공통 (data-body) ================= */
function renderBodyInputs() {
  document.querySelectorAll('[data-body]').forEach(i => { i.value = (S.prof && S.prof[i.dataset.body] != null) ? S.prof[i.dataset.body] : ''; });
  renderBodyPhoto();
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.body; if (!k || !isLogged()) return;
  S.prof = S.prof || {}; S.prof[k] = e.target.value; save();
  document.querySelectorAll('[data-body="' + k + '"]').forEach(i => { if (i !== e.target) i.value = e.target.value; });
  updateStepTabs();
  if ($('step-3-result').classList.contains('active')) renderResult();
});
function bodyOf(v) {
  v = v || {}; const h = +v.h || 160, w = +v.w || 52, n = x => (x ? +x : 0);
  const hip = n(v.hip) || Math.round(h * .575 + (w - 52) * .6);
  return { h, w, sho: n(v.sho) || Math.round(h * .238), arm: n(v.arm) || Math.round(h * .337), chest: n(v.chest) || Math.round(h * .5 + (w - 52) * .6 + 2), waist: n(v.waist) || Math.round(h * .4 + (w - 52) * .6), hip, thigh: Math.round(hip * .58) };
}
const myBody = () => bodyOf(S.prof);
const bodyOk = () => { const p = S.prof || {}; return +p.h >= 120 && +p.h <= 220 && +p.w >= 30 && +p.w <= 200; };
function saveBody() { save(); S.flash = '내 사이즈 정보를 저장했어요.'; save(); renderMy(); }
function resetProfile() { if (!confirm('키, 신체 치수와 선호 핏을 초기화할까요?')) return; S.prof = null; S.pref = '정핏'; S.usual = ''; save(); renderBodyInputs(); renderMy(); refreshAll(); }

/* ================= 홈 ================= */
function miniRow(ko, badge, sub, rank) {
  return `<div class="wire-card clickable brand-row" onclick="openBrandByName('${esc(ko)}')"><div class="brand-item-row">${rank ? `<span class="rank-no">${rank}</span>` : ''}<div class="brand-mini-icon">${esc(ko.slice(0, 1))}</div><div class="brand-copy"><h4>${esc(ko)}</h4><p class="sub-info mt-5">${sub}</p></div>${badge ? `<span class="badge active size-badge">${badge}</span>` : ''}</div></div>`;
}
function renderHome() {
  const c = $('home-reco-card'); if (!c) return;
  if (!D.ready) { c.innerHTML = '<p class="sub-info">브랜드 데이터를 불러오는 중이에요…</p>'; return; }
  if (!isLogged()) {
    let list = recommendBySize(homeSize), ref = '';
    if (!list.length) { const near = homeSize === 'XXS' ? 'XS' : homeSize === 'XXL' ? 'XL' : ''; if (near) { list = recommendBySize(near); ref = near; } }
    c.innerHTML = `<div class="row-between mb-10"><h3>사이즈별 인기 브랜드</h3><button class="link-btn" onclick="navigateTo('brand')">더보기 ›</button></div>
      <p class="sub-info mb-10">보통 <strong>${homeSize}</strong> 사이즈를 입던 분들은 이 브랜드를 이용해요.</p>
      <div class="chip-group mb-10">${SZ.map(s => `<button type="button" class="chip ${s === homeSize ? 'active' : ''}" onclick="setHomeSize('${s}')">${s}</button>`).join('')}</div>
      ${ref ? `<p class="sub-info mb-10">${homeSize} 사이즈 후기는 아직 없어서, 가장 가까운 <strong>${ref}</strong> 사이즈 기준으로 보여드려요.</p>` : ''}<div class="mt-10">${list.length ? list.map((x, i) => miniRow(x.brand, ref || homeSize, `${ref || homeSize} 착용 후기 ${x.n}건 · 구매 사이즈 적중 ${x.rate}% · ${tendency(x.brand)}`, i + 1)).join('') : `<p class="sub-info">아직 ${homeSize} 사이즈 후기 데이터가 없어요.</p>`}</div>
      <button class="btn btn-outline full-btn mt-10" onclick="showAuth('stay')">로그인하고 내 체형 맞춤 추천 받기</button>`;
    return;
  }
  const head = `<div class="row-between mb-10"><h3>내 체형에 맞는 브랜드 추천</h3><button class="link-btn" onclick="navigateTo('brand')">더보기 ›</button></div>`;
  if (!bodyOk()) {
    c.innerHTML = head + `<p class="sub-info mb-10">키와 몸무게를 입력하면 같은 체형의 후기를 바탕으로 브랜드를 추천해요.</p>
      <div class="form-row"><div class="form-field"><label>키</label><div class="unit-input"><input type="number" id="home-h" placeholder="예: 160"><span>cm</span></div></div><div class="form-field"><label>몸무게</label><div class="unit-input"><input type="number" id="home-w" placeholder="예: 52"><span>kg</span></div></div></div>
      <button class="btn btn-dark full-btn" onclick="saveHomeBody()">추천 받기</button>`;
    return;
  }
  const b = myBody(), list = recommendByBody(b.h, b.w).slice(0, 5);
  c.innerHTML = head + `<div class="row-between mb-10"><p class="sub-info">키 <strong>${b.h}cm</strong> · 몸무게 <strong>${b.w}kg</strong> 기준</p><button class="link-btn" onclick="navigateTo('mypage');switchMypageTab('body')">수정</button></div>
    <div class="mt-10">${list.map((x, i) => miniRow(x.brand, x.size, `비슷한 체형 ${x.n}명 중 ${x.agree}명이 ${x.size} · ${tendency(x.brand)} · 적합도 ${Math.round(x.score * 100)}%`, i + 1)).join('') || '<p class="sub-info">추천할 데이터가 부족해요.</p>'}</div>`;
}
function setHomeSize(s) { homeSize = s; renderHome(); }
function saveHomeBody() {
  const h = $('home-h').value, w = $('home-w').value;
  if (!(+h >= 120 && +h <= 220 && +w >= 30 && +w <= 200)) return alert('키(120~220cm)와 몸무게(30~200kg)를 입력해 주세요.');
  S.prof = Object.assign(S.prof || {}, { h, w }); save(); renderBodyInputs(); renderHome();
}

/* ================= 사이즈 측정 ================= */
let R = { itemId: null, pref: null, view: null, tab: 'viz' };
function startMeasure() { if (!requireLogin('size-input')) return; navigateTo('size-input'); switchInputStep(1); }
function measureItem(id) {
  if (!requireLogin(() => measureItem(id))) return;
  R.itemId = +id; navigateTo('size-input'); switchInputStep(bodyOk() ? 2 : 1);
}
function switchInputStep(step) {
  ['step-1-basic', 'step-1-detail', 'step-2-cloth', 'step-3-result'].forEach(id => $(id).classList.remove('active'));
  $(step === 1 ? 'step-1-basic' : step === 2 ? 'step-2-cloth' : step === 3 ? 'step-3-result' : 'step-1-detail').classList.add('active');
  ['1', '2', '3'].forEach(n => $('step-tab-' + n).classList.toggle('active', (n === '1' && (step === 1 || step === '1-detail')) || +n === step));
  if (step === 2) { renderSelectedItem(); renderClothPhotos(); }
  if (step === 3) renderResult();
  const b = document.querySelector('.app-body'); if (b) b.scrollTop = 0;
}
function updateStepTabs() {
  if (!$('step-tab-1')) return;
  $('step-tab-1').textContent = '1 신체 사이즈' + (bodyOk() ? ' ✓' : '');
  $('step-tab-2').textContent = '2 옷' + (R.itemId ? ' ✓' : '');
  $('step-tab-3').textContent = '3 결과' + (bodyOk() && R.itemId ? ' ✓' : '');
}
function goStep2() {
  if (!bodyOk()) { $('step1-msg').textContent = '키(120~220cm)와 몸무게(30~200kg)를 입력해 주세요.'; switchInputStep(1); return; }
  $('step1-msg').textContent = ''; switchInputStep(2);
}
function goStep3() {
  if (!bodyOk()) { $('step1-msg').textContent = '먼저 키와 몸무게를 입력해 주세요.'; switchInputStep(1); return; }
  if (!R.itemId) { $('step2-msg').textContent = '상품명을 검색해서 상품을 선택해 주세요.'; return; }
  $('step2-msg').textContent = ''; switchInputStep(3);
}

/* ---- 2. 옷: 상품 검색 ---- */
function searchItems() {
  const q = $('item-search').value.trim().toLowerCase(), box = $('item-results');
  if (!q) { box.innerHTML = ''; return; }
  if (!D.ready) { box.innerHTML = '<p class="sub-info">데이터를 불러오는 중이에요.</p>'; return; }
  const hits = D.items.filter(i => (i.brand + ' ' + (EN_OF[i.brand] || '') + ' ' + i.itemName + ' ' + i.subCategory + ' ' + i.category).toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(i => `<button type="button" class="item-result" onclick="pickItem(${i.id})"><strong>${esc(i.brand)}</strong> ${esc(i.itemName)}<span>${esc(i.subCategory)} · ${esc(i.labeledSize)} · ${won(i.price)}</span></button>`).join('') : '<p class="sub-info">검색 결과가 없어요.</p>';
}
function pickItem(id) {
  R.itemId = +id; R.view = null; $('item-results').innerHTML = ''; $('item-search').value = ''; $('step2-msg').textContent = ''; renderSelectedItem(); updateStepTabs();
}
function clearItem() { R.itemId = null; renderSelectedItem(); updateStepTabs(); }
function measureTable(it) { return `<div class="meas-grid">${Object.entries(it.measurements).map(([k, v]) => `<div><span>${MLABEL[k] || k}</span><strong>${v}cm</strong></div>`).join('')}</div>`; }
function renderSelectedItem() {
  const box = $('item-selected'), it = itemById(R.itemId);
  $('item-search').style.display = it ? 'none' : '';
  if (!it) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="wire-card"><div class="brand-item-row">${thumb(it)}<div class="brand-copy"><h4>[${esc(it.brand)}] ${esc(it.itemName)}</h4><p class="sub-info mt-5">${esc(it.subCategory)} · ${won(it.price)}</p></div><button class="btn btn-outline btn-sm" onclick="clearItem()">변경</button></div>
    <p class="sub-info mt-10">기준 사이즈 <strong>${esc(it.labeledSize)}</strong> 실측 (다른 사이즈는 한 치수당 일정 폭으로 계산해요)</p>${measureTable(it)}</div>`;
}
function compressImageFile(file, cb) {
  const reader = new FileReader();
  reader.onload = ev => { const img = new Image(); img.onload = () => { const sc = Math.min(1, 1200 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cb(cv.toDataURL('image/jpeg', .78)); }; img.onerror = () => cb(ev.target.result); img.src = ev.target.result; };
  reader.readAsDataURL(file);
}
function handleClothFiles(e) {
  [...(e.target.files || [])].forEach(file => { if (!file.type.startsWith('image/')) return; compressImageFile(file, src => { S.clothPhotos.push({ id: Date.now() + Math.random(), src, type: '상품 사진', name: file.name }); save(); renderClothPhotos(); }); });
  e.target.value = '';
}
function renderClothPhotos() {
  const box = $('cloth-attach-list'); if (!box) return;
  box.innerHTML = (S.clothPhotos || []).map(p => `<div class="attach-row photo-attach-row"><img class="attach-thumb" src="${p.src}" alt="추가한 사진"><select class="select-box" onchange="setClothPhotoType('${p.id}',this.value)"><option ${p.type === '상품 사진' ? 'selected' : ''}>상품 사진</option><option ${p.type === '사이즈표 캡처' ? 'selected' : ''}>사이즈표 캡처</option></select><button type="button" class="del-btn" aria-label="사진 삭제" onclick="removeClothPhoto('${p.id}')">✕</button></div>`).join('') || '<p class="sub-info">추가한 사진이 여기에 표시돼요.</p>';
}
function setClothPhotoType(id, t) { const p = S.clothPhotos.find(x => String(x.id) === String(id)); if (p) { p.type = t; save(); } }
function removeClothPhoto(id) { S.clothPhotos = S.clothPhotos.filter(p => String(p.id) !== String(id)); save(); renderClothPhotos(); }
function handleBodyPhoto(e) { const f = e.target.files[0]; if (!f) return; compressImageFile(f, src => { S.bodyPhoto = src; save(); renderBodyPhoto(); }); e.target.value = ''; }
function renderBodyPhoto() {
  const b = $('body-photo-preview'); if (!b) return;
  if (S.bodyPhoto) { b.style.backgroundImage = `url(${S.bodyPhoto})`; b.style.backgroundSize = 'cover'; b.style.backgroundPosition = 'center'; b.innerHTML = ''; b.classList.add('has-photo'); }
  else { b.style.backgroundImage = ''; b.classList.remove('has-photo'); b.innerHTML = '<button class="inner-btn">+ 전신 사진 올리기 (선택)</button>'; }
}
function deletePhotoData() { if (!confirm('저장된 전신 사진과 옷 입력 사진을 모두 삭제할까요?')) return; S.bodyPhoto = null; S.clothPhotos = []; save(); renderBodyPhoto(); renderClothPhotos(); alert('전신 사진과 옷 사진을 삭제했어요.'); }
function deleteAllRecords() { if (!confirm('분석 기록과 저장한 피드백을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return; S.records = []; S.feedbackPhotos = {}; save(); renderMy(); alert('전체 피드백 및 기록을 삭제했어요.'); }

/* ---- 3. 결과: 계산 ---- */
// 신체 대비 여유(cm) 목표: [슬림핏, 정핏, 오버핏]
const PARTS = [
  { k: 'chestCircumference', l: '가슴둘레', b: 'chest', step: 4, t: { top: [6, 12, 20], outer: [10, 16, 26], dress: [4, 8, 14] } },
  { k: 'waistCircumference', l: '허리둘레', b: 'waist', step: 4, t: { top: [6, 14, 24], outer: [10, 18, 28], dress: [2, 6, 12], skirt: [1, 3, 6], pants: [1, 3, 6] } },
  { k: 'hipCircumference', l: '엉덩이둘레', b: 'hip', step: 4, t: { pants: [4, 8, 14], skirt: [4, 8, 14] } },
  { k: 'thighCircumference', l: '허벅지둘레', b: 'thigh', step: 2.5, t: { pants: [2, 6, 12] } },
  { k: 'shoulderWidth', l: '어깨너비', b: 'sho', step: 1, t: { top: [0, 1.5, 4], outer: [1, 2.5, 5], dress: [0, 1.5, 3] } },
  { k: 'backWidth', l: '어깨(등)너비', b: 'sho', step: 1, t: { top: [1, 3, 6], outer: [2, 4, 7] } }
];
function kindOf(it) {
  const m = it.measurements;
  if (it.category === '하의') return 'pants';
  if (m.chestCircumference != null) return it.category === '아우터' ? 'outer' : it.category === '원피스/스커트' ? 'dress' : 'top';
  return 'skirt';
}
function computeFit(it, b, pref) {
  const m = it.measurements, kind = kindOf(it), base = Math.max(0, SZ.indexOf(it.labeledSize)), pi = PIDX[pref];
  const parts = PARTS.filter(p => m[p.k] != null && p.t[kind]);
  const sizes = SZ.map((label, i) => {
    const err = avg(parts.map(p => Math.abs(m[p.k] + (i - base) * p.step - b[p.b] - p.t[kind][pi])));
    return { label, i, err, pct: Math.max(8, Math.round(100 - err * 5)) };
  });
  let best = 0; sizes.forEach(s => { if (s.err < sizes[best].err) best = s.i; });
  return { kind, base, parts, sizes, best, pi };
}
function lenPos(f) { return f < .40 ? '허리 위' : f < .46 ? '허리 부근' : f < .56 ? '엉덩이 부근' : f < .66 ? '허벅지 중간' : f < .78 ? '무릎 부근' : f < .93 ? '종아리' : f < 1.0 ? '발목 부근' : '발목 아래(끌릴 수 있어요)'; }
function lengthOf(it, fit, i) { const m = it.measurements, base = m.frontLength != null ? m.frontLength : m.totalLength; return Math.round((base + (i - fit.base) * (fit.kind === 'pants' ? 2 : 1.5)) * 10) / 10; }
function posOf(it, fit, b, i) { const L = lengthOf(it, fit, i); return lenPos(fit.kind === 'pants' ? .40 + L / b.h : .185 + (L - 1) / b.h); }
function rowsAt(it, b, fit, i) {
  const m = it.measurements, rows = [];
  fit.parts.forEach(p => {
    const g = Math.round((m[p.k] + (i - fit.base) * p.step) * 10) / 10, bv = b[p.b], diff = Math.round((g - bv) * 10) / 10, d = diff - p.t[fit.kind][fit.pi];
    rows.push({ name: p.l, body: bv, g, diff, verdict: d < -2.5 ? '타이트' : d > 3.5 ? '넉넉' : '적당' });
  });
  const L = lengthOf(it, fit, i);
  rows.push({ name: '총장', body: null, g: L, diff: null, verdict: posOf(it, fit, b, i) });
  if (m.sleeveLength != null) {
    const sl = Math.round((m.sleeveLength + (i - fit.base)) * 10) / 10, dd = sl - b.arm;
    rows.push({ name: '소매길이', body: b.arm, g: sl, diff: Math.round(dd * 10) / 10, verdict: dd >= 2 ? '손등을 덮어요' : dd > -4 ? '손목 부근' : dd > -16 ? '팔꿈치~손목' : '반소매 길이' });
  }
  return rows;
}
function resultTable(rows) {
  return `<table class="wire-table result-table"><thead><tr><th>부위</th><th>신체</th><th>옷</th><th>차이</th><th>느낌</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.name}</td><td>${r.body == null ? '-' : r.body}</td><td>${r.g}</td><td class="bold">${r.diff == null ? '-' : sgn(r.diff)}</td><td>${r.verdict}</td></tr>`).join('')}</tbody></table>`;
}

/* ---- 3. 결과: 핏 시각화 (SVG 인체 모형) ---- */
function limbPoly(x0, y0, side, ang, L, w0, w1) {
  const a = ang * Math.PI / 180, dx = side * Math.sin(a), dy = Math.cos(a), nx = -dy, ny = dx, x1 = x0 + dx * L, y1 = y0 + dy * L;
  return [[x0 + nx * w0 / 2, y0 + ny * w0 / 2], [x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2], [x0 - nx * w0 / 2, y0 - ny * w0 / 2]];
}
const P = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
function fitSvg(it, b, fit, idx) {
  const m = it.measurements, k = fit.kind, d = idx - fit.base;
  const W = 330, H = 410, cx = 108, y0 = 22, h = b.h, s = (H - y0 - 16) / h;
  const Y = r => y0 + r * h * s, fw = c => c * .31 * s, mx = p => [2 * cx - p[0], p[1]];
  const shY = Y(.185), chY = Y(.265), waY = Y(.385), hiY = Y(.52), crY = Y(.54), knY = Y(.73), anY = Y(.96), btY = Y(1);
  // 인체 모형
  const shw = b.sho * s, cwB = fw(b.chest), wwB = fw(b.waist), half = fw(b.hip) / 2;
  const RB = [[cx + shw / 2, shY], [cx + cwB / 2, chY], [cx + wwB / 2, waY], [cx + half, hiY], [cx + half * .78, knY], [cx + half * .5, anY], [cx + half * .2, anY], [cx + half * .26, knY], [cx + 2, crY]];
  const body = [[cx - shw / 2, shY], ...RB, ...RB.slice().reverse().map(mx)];
  const armL = b.arm * s, armW = 7 * s;
  let svg = '';
  [-1, 1].forEach(sd => {
    const x0 = cx + sd * (shw / 2 - 2 * s), y1 = shY + 3, x1 = x0 + sd * Math.sin(.12) * armL, y2 = y1 + Math.cos(.12) * armL;
    svg += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="#888" stroke-width="${armW}" stroke-linecap="round"/><line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="#f0f0f0" stroke-width="${armW - 2}" stroke-linecap="round"/>`;
  });
  svg += `<rect x="${cx - 4.5 * s}" y="${y0 + .11 * h * s}" width="${9 * s}" height="${shY - y0 - .11 * h * s}" fill="#f0f0f0" stroke="#888"/><circle cx="${cx}" cy="${y0 + .065 * h * s}" r="${.058 * h * s}" fill="#f0f0f0" stroke="#888"/><polygon points="${P(body)}" fill="#f0f0f0" stroke="#888" stroke-width="1"/>`;
  // 옷 윤곽 + 표시선
  const ann = [], marks = [];
  const mark = (y, wpx, label1, label2) => { marks.push(`<line x1="${cx - wpx / 2}" y1="${y}" x2="${cx + wpx / 2}" y2="${y}" stroke="#222" stroke-width="1.6"/>`); ann.push({ y, x: cx + wpx / 2, l1: label1, l2: label2 }); };
  let hemY, lenTop;
  if (k === 'top' || k === 'outer' || k === 'dress') {
    const gc = m.chestCircumference + d * 4, gSh = m.shoulderWidth != null ? m.shoulderWidth + d : m.backWidth != null ? m.backWidth + d : b.sho + 2;
    const gW = m.waistCircumference != null ? m.waistCircumference + d * 4 : null, len = lengthOf(it, fit, idx);
    hemY = Math.min(Y(.985), shY - s + len * s); hemY = Math.max(hemY, chY + 12); lenTop = shY;
    let R1 = [[cx + gSh * s / 2, shY], [cx + fw(gc) / 2, chY]];
    if (k === 'dress' && gW && hemY > waY + 6) R1.push([cx + fw(gW) / 2, waY], [cx + fw(gW * 1.35) / 2, hemY]); else R1.push([cx + fw(gW && k !== 'outer' && k !== 'top' ? gW : gc) / 2, hemY]);
    const poly = [mx(R1[0]), ...R1, ...R1.slice().reverse().map(mx)];
    if (m.sleeveLength != null) { const sl = (m.sleeveLength + d) * s, w0 = gc / 8.5 * s; [-1, 1].forEach(sd => { svg += `<polygon points="${P(limbPoly(cx + sd * (gSh * s / 2 - 2), shY + 1, sd, 9, sl, w0, w0 * .78))}" fill="rgba(34,34,34,.07)" stroke="#222" stroke-dasharray="5 3"/>`; }); const sa = 9 * Math.PI / 180, ex = cx + gSh * s / 2 - 2 + Math.sin(sa) * sl, ey = shY + 1 + Math.cos(sa) * sl; ann.push({ y: ey, x: ex + 4, l1: `소매 ${Math.round(m.sleeveLength + d)}cm`, l2: `팔 대비 ${sgn(m.sleeveLength + d - b.arm)}` }); }
    svg += `<polygon points="${P(poly)}" fill="rgba(34,34,34,.08)" stroke="#222" stroke-width="1.3" stroke-dasharray="5 3"/>`;
    mark(shY, gSh * s, `어깨 ${sgn(gSh - b.sho)}`, '');
    mark(chY, fw(gc), `가슴 ${sgn(gc - b.chest)}`, '둘레 ' + Math.round(gc) + 'cm');
    if (gW && k === 'dress') mark(waY, fw(gW), `허리 ${sgn(gW - b.waist)}`, '');
  } else {
    const gWc = m.waistCircumference + d * 4, gH = m.hipCircumference != null ? m.hipCircumference + d * 4 : null, len = lengthOf(it, fit, idx);
    const wy = waY + .015 * h * s; hemY = Math.min(btY - 2, wy + len * s); lenTop = wy;
    const gH2 = gH != null ? fw(gH) / 2 : half;
    let poly;
    if (k === 'pants') {
      const hw = (m.hemWidth + d * .7) * s, inn = cx + 2.5, xc = inn + hw / 2, o = inn + hw;
      const RR = [[cx + fw(gWc) / 2, wy], [cx + gH2, hiY], [o, hemY], [inn, hemY], [cx + 1.5, crY + 6]];
      poly = [mx(RR[0]), ...RR, ...RR.slice().reverse().map(mx)];
      if (m.thighCircumference != null) { const ty = Y(.6), tx = cx + half * .9; ann.push({ y: ty, x: tx, l1: `허벅지 ${sgn(m.thighCircumference + d * 2.5 - b.thigh)}`, l2: '둘레 ' + Math.round(m.thighCircumference + d * 2.5) + 'cm' }); }
    } else {
      const RR = [[cx + fw(gWc) / 2, wy], [cx + gH2, hiY], [cx + gH2 * 1.12, hemY]]; poly = [mx(RR[0]), ...RR, ...RR.slice().reverse().map(mx)];
    }
    svg += `<polygon points="${P(poly)}" fill="rgba(34,34,34,.08)" stroke="#222" stroke-width="1.3" stroke-dasharray="5 3"/>`;
    mark(wy, fw(gWc), `허리 ${sgn(gWc - b.waist)}`, '둘레 ' + Math.round(gWc) + 'cm');
    if (gH != null) mark(hiY, fw(gH), `엉덩이 ${sgn(gH - b.hip)}`, '둘레 ' + Math.round(gH) + 'cm');
  }
  // 총장 표시 (왼쪽 세로선) + 끝선
  const L = lengthOf(it, fit, idx), ym = (lenTop + hemY) / 2;
  svg += `<line x1="16" y1="${lenTop}" x2="16" y2="${hemY}" stroke="#222" stroke-width="1.2"/><line x1="11" y1="${lenTop}" x2="21" y2="${lenTop}" stroke="#222"/><line x1="11" y1="${hemY}" x2="21" y2="${hemY}" stroke="#222"/><text transform="rotate(-90 9 ${ym})" x="9" y="${ym}" text-anchor="middle" font-size="10" font-weight="700" fill="#222">총장 ${L}cm</text><line x1="${cx - 60}" y1="${hemY}" x2="${cx + 60}" y2="${hemY}" stroke="#222" stroke-width="1" stroke-dasharray="2 2"/>`;
  ann.push({ y: hemY, x: cx + 60, l1: `기장 ${posOf(it, fit, b, idx)}`, l2: '' });
  ann.sort((a, c) => a.y - c.y); let last = -99;
  ann.forEach(a => { a.ty = Math.max(a.y, last + (a.l2 ? 27 : 17)); last = a.ty; });
  ann.forEach(a => { svg += `<line x1="${a.x}" y1="${a.y}" x2="214" y2="${a.ty}" stroke="#999" stroke-dasharray="2 2"/><circle cx="${a.x}" cy="${a.y}" r="2" fill="#222"/><text x="218" y="${a.ty + 3}" font-size="10" fill="#222"><tspan font-weight="700">${esc(a.l1)}</tspan>${a.l2 ? `<tspan x="218" dy="12" font-size="9" fill="#666">${esc(a.l2)}</tspan>` : ''}</text>`; });
  return `<svg class="fit-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="핏 시각화">${svg}${marks.join('')}</svg>`;
}

/* ---- 3. 결과: 렌더 ---- */
function similarNote(it, b) {
  let rs = D.reviews.filter(r => r.brand === it.brand && r.cat === it.revCat);
  if (rs.length < 3) rs = D.reviews.filter(r => r.brand === it.brand);
  if (!rs.length) return '';
  const nb = rs.map(r => ({ r, d: Math.hypot((r.h - b.h) / 6, (r.w - b.w) / 5) })).sort((a, c) => a.d - c.d).slice(0, 5), cnt = {};
  nb.forEach(x => { cnt[x.r.fitted] = (cnt[x.r.fitted] || 0) + 1; });
  const top = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0];
  return `<div class="wire-card"><h4>후기 참고</h4><p class="sub-info mt-5">${esc(it.brand)} 후기 중 키·몸무게가 가장 비슷한 ${nb.length}명 가운데 <strong>${cnt[top]}명</strong>이 <strong>${top}</strong> 사이즈가 맞았다고 했어요.</p></div>`;
}
function renderResult() {
  const box = $('result-body'), it = itemById(R.itemId);
  if (!bodyOk() || !it) {
    box.innerHTML = `<div class="wire-card text-center"><h4>결과는 1·2번을 완료하면 나와요</h4><p class="sub-info mt-5 mb-10">${bodyOk() ? '' : '1 신체 사이즈: 키·몸무게를 입력해 주세요.<br>'}${it ? '' : '2 옷: 상품을 검색해서 선택해 주세요.'}</p><div class="btn-row">${bodyOk() ? '' : '<button class="btn btn-dark flex-1" onclick="switchInputStep(1)">1 신체 사이즈</button>'}${it ? '' : '<button class="btn btn-dark flex-1" onclick="switchInputStep(2)">2 옷</button>'}</div></div>`;
    return;
  }
  const pref = S.pref, b = myBody(), fit = computeFit(it, b, pref);
  if (R.view == null || R.pref !== pref || R.fitItem !== it.id) { R.view = fit.best; R.pref = pref; R.fitItem = it.id; }
  const best = fit.sizes[fit.best], rows = rowsAt(it, b, fit, R.view), bp = fit.parts.find(p => p.k === 'chestCircumference') || fit.parts[0];
  let note = '';
  if (bp) { const e = it.measurements[bp.k] + (fit.best - fit.base) * bp.step - b[bp.b] - bp.t[fit.kind][fit.pi]; if (Math.abs(e) > 4) note = `<p class="sub-info mt-5">이 상품은 ${pref} 기준보다 ${e > 0 ? '넉넉' : '타이트'}하게 나올 수 있어요. (가장 가까운 사이즈가 ${best.label}예요)</p>`; }
  box.innerHTML = `<div class="wire-card text-center"><p class="sub-text">[${esc(it.brand)}] ${esc(it.itemName)}</p>
    <p class="sub-text mt-5">추천 사이즈 <span class="highlight-lg">${best.label}</span> · ${pref} 기준</p>
    <div class="size-bar-chart">${fit.sizes.map(x => `<div class="chart-col clickable ${x.i === R.view ? 'active' : ''}" onclick="viewSize(${x.i})"><div class="bar" style="height:${x.pct}%"></div><span>${x.label} ${x.pct}%</span></div>`).join('')}</div>
    <p class="sub-info mt-10">막대를 누르면 그 사이즈로 볼 수 있어요 · 현재 보기 <strong>${SZ[R.view]}</strong></p>${note}</div>
    <div class="wire-card"><h4>선호 핏</h4><div class="seg-group mt-5">${PREFS.map(p => `<button class="seg-btn ${p === pref ? 'active' : ''}" onclick="setPref('${p}')">${p}</button>`).join('')}</div><p class="sub-info mt-5">${pref}: ${PREF_DESC[pref]}</p></div>
    <div class="wire-card"><div class="toggle-group"><button class="toggle-btn ${R.tab === 'viz' ? 'active' : ''}" onclick="setResultTab('viz')">핏 시각화</button><button class="toggle-btn ${R.tab === 'table' ? 'active' : ''}" onclick="setResultTab('table')">부위별 표</button></div>
    ${R.tab === 'viz' ? `<div class="fit-canvas-svg">${fitSvg(it, b, fit, R.view)}</div><p class="canvas-note-static">회색 인체 모형(키 ${b.h}cm) · 점선 = ${SZ[R.view]} 사이즈 옷 윤곽 · 굵은 선 = 어깨·가슴 등 부위</p>` : `<h4 class="mt-10">${SZ[R.view]} 사이즈 부위별 비교</h4>${resultTable(rows)}<p class="sub-info mt-5">차이 = 옷 치수 − 내 신체 (둘레 기준). 신체 항목을 비워두면 키·몸무게로 추정한 값이에요.</p>`}</div>
    ${similarNote(it, b)}
    <div class="btn-row"><button class="btn btn-outline flex-1" onclick="switchInputStep(2)">옷 변경</button><button class="btn btn-dark flex-1" onclick="saveResult()">저장</button></div>`;
}
function viewSize(i) { R.view = i; renderResult(); }
function setResultTab(t) { R.tab = t; renderResult(); }
function setPref(v) { S.pref = v; save(); R.view = null; if ($('step-3-result').classList.contains('active')) renderResult(); if (page === 'mypage') renderMy(); }
function saveResult() {
  const it = itemById(R.itemId); if (!it || !bodyOk()) return;
  const b = myBody(), fit = computeFit(it, b, S.pref), rows = rowsAt(it, b, fit, fit.best).filter(r => r.body != null && r.name.endsWith('둘레')).map(r => [r.name, r.body, r.g]);
  const d = new Date(), p = n => String(n).padStart(2, '0');
  S.records.unshift({ id: Date.now(), date: `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`, itemId: it.id, name: `${it.brand} ${it.itemName}`, cat: it.category, size: SZ[fit.best], pref: S.pref, rows, fb: null });
  S.flash = '분석을 저장했어요. 아래 분석 기록에서 확인하세요.'; save();
  navigateTo('mypage'); switchMypageTab('record');
}

/* ================= 브랜드 ================= */
function thumb(it) { return `<div class="wire-x-box square-50 thumb"><img src="${esc(it.imageUrl)}" alt="" loading="lazy" onerror="this.remove()"></div>`; }
function heartBtn(on, fn) { return `<button type="button" class="heart-btn ${on ? 'on' : ''}" aria-label="좋아요" onclick="event.stopPropagation();${fn}">${on ? '♥' : '♡'}</button>`; }
function brandRow(b, rec) {
  const n = brandItems(b.ko).length, on = S.brands.includes(b.ko);
  return `<div class="wire-card clickable brand-row" onclick="openBrand(${b.id})"><div class="brand-item-row"><div class="brand-mini-icon">${esc(b.ko.slice(0, 1))}</div><div class="brand-copy"><h4>${esc(b.ko)}${b.en && b.en !== b.ko ? ` <span class="en-name">${esc(b.en)}</span>` : ''}</h4>
    <p class="sub-info mt-5">${n ? '상품 ' + n + '개' : '등록된 상품 없음'} · ${tendency(b.ko)}</p>${rec ? `<span class="badge active">내 추천 ${rec.size}</span>` : ''}</div>${heartBtn(on, `toggleLikeBrand('${esc(b.ko)}')`)}</div></div>`;
}
function renderBrands() {
  const box = $('brand-list'); if (!D.ready) { box.innerHTML = '<p class="sub-info">브랜드 데이터를 불러오는 중이에요…</p>'; return; }
  const q = ($('brand-search').value || '').trim().toLowerCase();
  const list = D.brands.filter(b => !q || (b.ko + ' ' + b.en).toLowerCase().includes(q));
  const recMap = {}; if (isLogged() && bodyOk()) { const b = myBody(); recommendByBody(b.h, b.w).forEach(r => { recMap[r.brand] = r; }); }
  box.innerHTML = list.length ? list.map(b => brandRow(b, recMap[b.ko])).join('') : '<p class="sub-info">검색 결과가 없어요.</p>';
}
function openBrandByName(ko) { const b = D.brands.find(x => x.ko === ko); if (b) openBrand(b.id); }
function openBrand(id) { if (page !== 'brand-detail') hist.push(page); curBrand = id; brandCatFilter = '전체'; brandReviewsOpen = false; showPage('brand-detail'); }
function setBrandCat(c) { brandCatFilter = c; renderBrandDetail(); }
function toggleLikeBrand(ko) {
  if (!requireLogin('stay')) return;
  const i = S.brands.indexOf(ko); i < 0 ? S.brands.push(ko) : S.brands.splice(i, 1); save(); showPageNoScroll(); renderHome();
}
function toggleLikeItem(id) {
  if (!requireLogin('stay')) return;
  const i = S.likedItems.indexOf(+id); i < 0 ? S.likedItems.push(+id) : S.likedItems.splice(i, 1); save(); showPageNoScroll();
}
function itemRatingText(it) { const rs = itemReviews(it); return rs.length ? `★ ${avg(rs.map(r => r.rating)).toFixed(1)} (${rs.length})` : '후기 없음'; }
function itemRow(it) {
  return `<div class="wire-card clickable brand-row" onclick="openProduct(${it.id})"><div class="brand-item-row">${thumb(it)}<div class="brand-copy"><h4>${esc(it.itemName)}</h4><p class="sub-info mt-5">${esc(it.subCategory)} · ${won(it.price)}</p><div class="badge-group"><span class="badge">${esc(it.labeledSize)}</span><span class="badge">${itemRatingText(it)}</span></div></div></div></div>`;
}
function renderBrandDetail() {
  const box = $('brand-detail-body'), b = D.brands.find(x => x.id === curBrand); if (!b) { box.innerHTML = ''; return; }
  const items = brandItems(b.ko), cats = ['전체', ...new Set(items.map(i => i.category))], shown = items.filter(i => brandCatFilter === '전체' || i.category === brandCatFilter);
  const rs = (D.byBrand[b.ko] || []), cnt = {}; rs.forEach(r => { cnt[r.fitted] = (cnt[r.fitted] || 0) + 1; });
  const dist = SZ.filter(s => cnt[s]).map(s => `${s} ${cnt[s]}`).join(' · ');
  const revShown = brandReviewsOpen ? rs : rs.slice(0, 3);
  box.innerHTML = `<div class="wire-card"><div class="brand-item-row"><div class="brand-mini-icon">${esc(b.ko.slice(0, 1))}</div><div class="brand-copy"><h3>${esc(b.ko)}</h3><p class="sub-info">${esc(b.en || '')}${b.website ? ` · <a href="${esc(b.website)}" target="_blank" rel="noopener">공식 사이트 ↗</a>` : ''}</p></div>${heartBtn(S.brands.includes(b.ko), `toggleLikeBrand('${esc(b.ko)}')`)}</div>
    ${b.cats ? `<div class="mt-10">${b.cats.map(c => `<p class="sub-info cat-line"><strong>${esc(c.medium_name)}</strong> ${c.small_categories.map(esc).join(' · ')}</p>`).join('')}</div>` : ''}</div>
    <div class="wire-card"><h4>사이즈 경향</h4><p class="sub-info mt-5">${tendency(b.ko)} · 후기 ${rs.length}건${dist ? '<br>맞았던 사이즈: ' + dist : ''}</p></div>
    <h4 class="mb-10 mt-15">상품 ${items.length}개</h4>
    ${items.length > 1 ? `<div class="pill-group">${cats.map(c => `<button class="pill ${c === brandCatFilter ? 'active' : ''}" onclick="setBrandCat('${c}')">${c}</button>`).join('')}</div>` : ''}
    ${shown.length ? shown.map(itemRow).join('') : '<p class="sub-info">이 브랜드는 아직 등록된 상품이 없어요.</p>'}
    ${rs.length ? `<h4 class="mb-10 mt-20">체형별 후기</h4>${revShown.map(reviewCard).join('')}${rs.length > 3 ? `<button class="btn btn-outline full-btn" onclick="brandReviewsOpen=!brandReviewsOpen;renderBrandDetail()">${brandReviewsOpen ? '접기' : '후기 더보기 (' + rs.length + ')'}</button>` : ''}` : ''}`;
}

/* ---- 상품 상세 ---- */
function openProduct(id) {
  if (page !== 'product-detail') hist.push(page);
  curItem = +id;
  if (isLogged()) { S.recent = [curItem, ...S.recent.filter(x => x !== curItem)].slice(0, 20); save(); }
  showPage('product-detail');
}
function reviewCard(r) {
  const fits = r.fit ? Object.entries(r.fit).map(([k, v]) => `<span class="badge">${esc(k)} ${esc(v)}</span>`).join('') : '';
  return `<div class="record-card review-card"><div class="rec-head"><span class="stars">${stars(r.rating || 0)}</span><span>${esc(r.date || '')}</span></div>
    <div class="badge-group"><span class="badge active">구매 ${esc(r.size || '-')}</span>${r.opinion ? `<span class="badge">${esc(r.opinion)}</span>` : ''}${r.lenOpinion ? `<span class="badge">기장 ${esc(r.lenOpinion)}</span>` : ''}</div>
    ${fits ? `<div class="badge-group wrap">${fits}</div>` : ''}<p class="feedback-memo mt-5">${esc(r.text)}</p><p class="sub-info mt-5">키 ${r.h}cm · ${r.w}kg${r.fitted ? ' · 맞는 사이즈 ' + esc(r.fitted) : ''}</p></div>`;
}
function renderProduct() {
  const box = $('product-detail-body'), it = itemById(curItem); if (!it) { box.innerHTML = '<p class="sub-info">상품을 찾을 수 없어요.</p>'; return; }
  const rs = itemReviews(it), op = { '작은 편': 0, '정사이즈': 0, '큰 편': 0 }; rs.forEach(r => { if (op[r.opinion] != null) op[r.opinion]++; });
  const b = D.brands.find(x => x.ko === it.brand);
  let fb = ''; if (!rs.length) { const alt = (D.byBrand[it.brand] || []).filter(r => r.cat === it.revCat).slice(0, 3); fb = alt.length ? `<p class="sub-info mb-10">이 상품에 등록된 후기가 없어서, 같은 브랜드·카테고리의 체형별 후기를 보여드려요.</p>${alt.map(reviewCard).join('')}` : '<p class="sub-info">등록된 후기가 없어요.</p>'; }
  box.innerHTML = `<div class="wire-card"><div class="wire-x-box big-box thumb big-thumb"><img src="${esc(it.imageUrl)}" alt="" onerror="this.remove()"></div>
    <div class="row-between mt-10"><p class="sub-info clickable" onclick="${b ? `openBrand(${b.id})` : ''}">${esc(it.brand)} ›</p>${heartBtn(S.likedItems.includes(it.id), `toggleLikeItem(${it.id})`)}</div>
    <h3 class="mt-5">${esc(it.itemName)}</h3><p class="highlight-md mt-5">${won(it.price)}</p>
    <div class="badge-group wrap mt-10"><span class="badge">${esc(it.category)}</span><span class="badge">${esc(it.subCategory)}</span><span class="badge">${esc(it.gender)}</span><span class="badge active">기준 ${esc(it.labeledSize)}</span></div>
    <p class="sub-info mt-10">색상 ${(it.colors || []).map(esc).join(' · ')}</p></div>
    <div class="wire-card"><h4>상품 실측 (${esc(it.labeledSize)} 사이즈)</h4>${measureTable(it)}</div>
    <div class="btn-row mb-15"><button class="btn btn-dark flex-1" onclick="measureItem(${it.id})">이 상품 사이즈 측정</button>${it.productUrl ? `<a class="btn btn-outline flex-1 btn-link" href="${esc(it.productUrl)}" target="_blank" rel="noopener">상품 페이지 ↗</a>` : ''}</div>
    <div class="row-between mb-10"><h4>후기 ${rs.length}건</h4>${rs.length ? `<span class="sub-info">${stars(avg(rs.map(r => r.rating)))} ${avg(rs.map(r => r.rating)).toFixed(1)}</span>` : ''}</div>
    ${rs.length ? `<div class="wire-card"><p class="sub-info">사이즈 의견 · 작은 편 ${op['작은 편']} / 정사이즈 ${op['정사이즈']} / 큰 편 ${op['큰 편']}</p></div>${rs.map(reviewCard).join('')}` : fb}
    <p class="sub-info mt-10">후기는 샘플 데이터(reviews.json)예요.</p>`;
}

/* ================= 마이페이지 ================= */
const MY_TABS = ['profile', 'body', 'record', 'feedback', 'likes', 'recent'];
let myTab = 'profile';
function switchMypageTab(n) {
  myTab = n;
  MY_TABS.forEach(k => $('mypage-tab-' + k).classList.toggle('active', k === n));
  document.querySelectorAll('#mypage-tabs .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === n));
}
function renderMy() {
  if (!isLogged()) return;
  $('mypage-flash').innerHTML = S.flash ? `<div class="flash">${esc(S.flash)}</div>` : ''; if (S.flash) { S.flash = ''; save(); }
  switchMypageTab(myTab);
  $('prof-id').textContent = currentUser; $('prof-avatar').textContent = currentUser.slice(0, 1).toUpperCase();
  $('sum-saved').textContent = S.records.length + '건'; $('sum-fb').textContent = S.records.filter(r => r.fb).length + '건'; $('sum-pref').textContent = S.pref;
  $('usual-size-chips').innerHTML = SZ.map(s => `<button class="chip ${S.usual === s ? 'active' : ''}" onclick="setUsual('${s}')">${s}</button>`).join('');
  $('pref-selector').innerHTML = PREFS.map(p => `<div class="pref-box ${p === S.pref ? 'active' : ''}" onclick="setPref('${p}')"><strong>${p}${p === S.pref ? ' ✓' : ''}</strong><span>${PREF_DESC[p]}</span></div>`).join('');
  renderBodyInputs();
  $('record-list').innerHTML = S.records.length ? S.records.map(recCard).join('') : '<p class="sub-info">저장한 분석이 없어요. 사이즈 측정 후 결과를 저장해 보세요.</p>';
  renderFeedbackTargets(); renderFeedbackList(); renderLikes(); renderRecent();
}
function setUsual(s) { S.usual = S.usual === s ? '' : s; save(); renderMy(); }
function recCard(r) {
  return `<div class="record-card"><div class="rec-head"><span>${esc(r.date)}</span><span class="dots">···</span></div><div class="rec-body"><div class="wire-x-box square-50"></div><div><h5>${esc(r.name)}</h5>
    <div class="badge-group"><span class="badge">${esc(r.size)} · ${esc(r.pref)}</span><span class="badge ${r.fb ? '' : 'active'}">${r.fb ? '피드백 완료' : '피드백 작성 전'}</span></div><p class="sub-info">${r.rows.map(x => x[0] + ' ' + sgn(x[2] - x[1])).join(' · ')}</p></div></div>
    <div class="rec-actions"><button class="link-action" onclick="openAnalysis(${r.id})">결과 보기 ↗</button><button class="link-action" onclick="reuseRecord(${r.id})">입력값 재사용</button><button class="link-action text-del" onclick="delRec(${r.id})">삭제</button></div></div>`;
}
function openAnalysis(id) {
  const r = S.records.find(x => x.id === id); if (!r) return;
  $('analysis-modal-body').innerHTML = `<p class="sub-info mb-10">${esc(r.cat)} · ${esc(r.pref)} 기준 · ${esc(r.date)} 저장</p><div class="wire-card text-center"><h4>${esc(r.name)}<br>추천 사이즈 ${esc(r.size)}</h4></div><h4>부위별 차이</h4>
    <table class="wire-table"><thead><tr><th>부위</th><th>신체</th><th>옷</th><th>차이</th></tr></thead><tbody>${r.rows.map(x => `<tr><td>${esc(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td class="bold">${sgn(x[2] - x[1])}</td></tr>`).join('')}</tbody></table>
    <div class="btn-row mt-15"><button class="btn btn-dark flex-1" onclick="reuseRecord(${id})">다시 분석</button><button class="btn btn-outline flex-1" onclick="delRec(${id})">저장 삭제</button></div>`;
  openModal('modal-saved-analysis');
}
function reuseRecord(id) {
  const r = S.records.find(x => x.id === id); if (!r) return;
  closeModal('modal-saved-analysis'); R.itemId = r.itemId || null; if (PREFS.includes(r.pref)) S.pref = r.pref; save();
  navigateTo('size-input'); switchInputStep(R.itemId && bodyOk() ? 3 : bodyOk() ? 2 : 1);
}
function delRec(id) { S.records = S.records.filter(r => r.id !== id); save(); closeModal('modal-saved-analysis'); renderMy(); }

/* ---- 마이 피드백 ---- */
let FB = { fit: '정핏', parts: {} };
const FB_PARTS = { '상의': ['가슴', '어깨', '소매'], '아우터': ['가슴', '어깨', '소매'], '하의': ['허리', '힙', '기장'], '원피스/스커트': ['가슴', '허리', '기장'] };
function renderFeedbackTargets() {
  const cur = $('fb-target').value;
  $('fb-target').innerHTML = S.records.length ? S.records.map(r => `<option value="${r.id}">${esc(r.name)} · ${esc(r.size)}</option>`).join('') : '<option value="">분석 기록이 없어요</option>';
  if (cur && S.records.some(r => String(r.id) === cur)) $('fb-target').value = cur;
  fillFbForm();
}
function fillFbForm() {
  const r = S.records.find(x => String(x.id) === $('fb-target').value);
  $('fb-size').innerHTML = SZ.map(s => `<option ${(r && (r.fb ? r.fb.size : r.size)) === s ? 'selected' : ''}>${s}</option>`).join('');
  const parts = FB_PARTS[r ? r.cat : '상의'] || FB_PARTS['상의'];
  FB = { fit: (r && r.fb && r.fb.fit) || '정핏', parts: {} }; parts.forEach(p => { FB.parts[p] = (r && r.fb && r.fb.parts && r.fb.parts[p]) || '적당'; });
  $('fb-memo').value = (r && r.fb && r.fb.memo) || '';
  renderFbControls(); renderFeedbackPhoto();
}
function renderFbControls() {
  $('fb-fit-chips').innerHTML = ['작음', '정핏', '여유'].map(v => `<button type="button" class="chip ${FB.fit === v ? 'active' : ''}" onclick="setFbFit('${v}')">${v}</button>`).join('');
  $('fb-parts').innerHTML = Object.keys(FB.parts).map(p => `<div>${p}</div>${['작음', '적당', '여유'].map(v => `<button type="button" class="chip-sm ${FB.parts[p] === v ? 'active' : ''}" onclick="setFbPart('${p}','${v}')">${v}</button>`).join('')}`).join('');
}
function setFbFit(v) { FB.fit = v; renderFbControls(); }
function setFbPart(p, v) { FB.parts[p] = v; renderFbControls(); }
function handleFeedbackPhoto(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return; if (!file.type.startsWith('image/')) return alert('이미지 파일을 선택해 주세요.');
  const id = $('fb-target').value; if (!id) { e.target.value = ''; return alert('분석 기록을 먼저 저장해 주세요.'); }
  compressImageFile(file, src => { S.feedbackPhotos[id] = src; save(); renderFeedbackPhoto(); renderFeedbackList(); }); e.target.value = '';
}
function renderFeedbackPhoto() { const id = $('fb-target').value, src = (S.feedbackPhotos || {})[id]; $('fb-photo-preview').innerHTML = src ? `<div class="feedback-photo-wrap"><img src="${src}" alt="착용 피드백 사진"><button type="button" class="photo-remove" onclick="removeFeedbackPhoto()">✕</button></div>` : ''; }
function removeFeedbackPhoto() { delete S.feedbackPhotos[$('fb-target').value]; save(); renderFeedbackPhoto(); renderFeedbackList(); }
function saveFeedback() {
  const r = S.records.find(x => String(x.id) === $('fb-target').value); if (!r) return alert('분석 기록을 먼저 저장해 주세요.');
  r.fb = { size: $('fb-size').value, fit: FB.fit, parts: { ...FB.parts }, memo: $('fb-memo').value, savedAt: new Date().toLocaleString('ko-KR') };
  save(); renderMy(); alert('피드백 저장 완료');
}
function renderFeedbackList() {
  const rows = S.records.filter(r => r.fb);
  $('feedback-list').innerHTML = rows.length ? rows.map(r => `<div class="record-card feedback-saved"><div class="rec-head"><span>${esc(r.date)} · ${esc(r.name)}</span><span class="badge">저장됨</span></div><p class="mt-5"><strong>실제 사이즈 ${esc(r.fb.size || '-')} · ${esc(r.fb.fit || '핏 미입력')}</strong></p><p class="sub-info mt-5">${Object.entries(r.fb.parts || {}).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ')}</p>${r.fb.memo ? `<p class="feedback-memo mt-5">${esc(r.fb.memo)}</p>` : ''}${S.feedbackPhotos[String(r.id)] ? `<img class="saved-feedback-image mt-5" src="${S.feedbackPhotos[String(r.id)]}" alt="저장된 착용 사진">` : ''}<div class="rec-actions"><button class="link-action" onclick="editFeedback('${r.id}')">수정하기</button></div></div>`).join('') : '<p class="sub-info">아직 저장한 피드백이 없어요. 아래에서 피드백을 작성해 주세요.</p>';
}
function editFeedback(id) { $('fb-target').value = id; fillFbForm(); $('fb-memo').scrollIntoView({ behavior: 'smooth', block: 'center' }); }

/* ---- 좋아요 / 최근 본 ---- */
function renderLikes() {
  const bs = S.brands.map(ko => D.brands.find(b => b.ko === ko)).filter(Boolean);
  $('liked-brands').innerHTML = bs.length ? bs.map(b => brandRow(b, null)).join('') : '<p class="sub-info">좋아요한 브랜드가 없어요. 브랜드 탭에서 ♡를 눌러 보세요.</p>';
  const its = S.likedItems.map(itemById).filter(Boolean);
  $('liked-items').innerHTML = its.length ? its.map(i => `<div class="wire-card clickable brand-row" onclick="openProduct(${i.id})"><div class="brand-item-row">${thumb(i)}<div class="brand-copy"><p class="sub-info">${esc(i.brand)}</p><h4>${esc(i.itemName)}</h4><p class="sub-info mt-5">${won(i.price)}</p></div>${heartBtn(true, `toggleLikeItem(${i.id})`)}</div></div>`).join('') : '<p class="sub-info">좋아요한 상품이 없어요. 상품 상세에서 ♡를 눌러 보세요.</p>';
}
function renderRecent() {
  const its = S.recent.map(itemById).filter(Boolean);
  $('recent-items').innerHTML = its.length ? its.map(i => `<div class="wire-card clickable brand-row" onclick="openProduct(${i.id})"><div class="brand-item-row">${thumb(i)}<div class="brand-copy"><p class="sub-info">${esc(i.brand)}</p><h4>${esc(i.itemName)}</h4><p class="sub-info mt-5">${won(i.price)} · ${esc(i.labeledSize)}</p></div></div></div>`).join('') : '<p class="sub-info">최근 본 상품이 없어요.</p>';
}
function clearRecent() { S.recent = []; save(); renderRecent(); }

/* ================= 시작 ================= */
initializeAuth(); renderBodyInputs(); renderHome(); loadData();
