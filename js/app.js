/**
 * 핏센스 (FitSense) 스크립트
 */

// 글로벌 상태 데이터
let currentUser = null;
let clothItemCount = 0;
let userRecordsCount = 2;

// 페이지 라우터
function navigateTo(pageId) {
  const pages = document.querySelectorAll('.page-section');
  pages.forEach(p => p.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // 하단 탭 바 활성화 상태 업데이트
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 사이즈 입력 페이지 진입 시 항시 1 신체 사이즈 탭부터 등장
  if (pageId === 'size-input') {
    switchInputStep(1);
  }

  // 스크롤 맨 위로 이동
  const appBody = document.querySelector('.app-body');
  if (appBody) appBody.scrollTop = 0;
}

// 카테고리 클릭 시 사이즈 입력 페이지로 이동 후 step 2(옷 입력) 전환
function selectCategory(category) {
  navigateTo('size-input');
  switchInputStep(2);
}

// 입력 단계 스위치 (1: 기본 신체, 1-detail: 상세 신체, 2: 옷 정보)
function switchInputStep(step) {
  const step1Basic = document.getElementById('step-1-basic');
  const step1Detail = document.getElementById('step-1-detail');
  const step2Cloth = document.getElementById('step-2-cloth');

  const tab1 = document.getElementById('step-tab-1');
  const tab2 = document.getElementById('step-tab-2');

  [step1Basic, step1Detail, step2Cloth].forEach(el => el.classList.remove('active'));

  if (step === 1) {
    step1Basic.classList.add('active');
    tab1.classList.add('active');
    tab2.classList.remove('active');
  } else if (step === '1-detail') {
    step1Detail.classList.add('active');
    tab1.classList.add('active');
    tab2.classList.remove('active');
  } else if (step === 2) {
    step2Cloth.classList.add('active');
    tab1.classList.remove('active');
    tab2.classList.add('active');
  }
}

// 숫자 및 소수점('.')만 입력되도록 처리하는 검증기
function validateNumberInput(input) {
  // 숫자와 소수점 외의 모든 문자 제거
  let value = input.value.replace(/[^0-9.]/g, '');
  
  // 소수점이 여러 개 입력되는 현상 방지
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }
  
  input.value = value;
}

// 신체 사진 업로드 핸들러
function handleBodyPhoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const box = document.getElementById('body-photo-preview');
      box.style.backgroundImage = `url(${e.target.result})`;
      box.style.backgroundSize = 'cover';
      box.style.backgroundPosition = 'center';
      box.innerHTML = '';
    };
    reader.readAsDataURL(file);
  }
}

// 옷 사진 추가 핸들러 (사진 업로드 -> 분류 선택, 카테고리 선택, 사이즈 선택)
function handleClothPhotoAdd(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    clothItemCount++;
    const container = document.getElementById('cloth-items-container');

    const itemDiv = document.createElement('div');
    itemDiv.className = 'cloth-item-card';
    itemDiv.id = `cloth-item-${clothItemCount}`;

    itemDiv.innerHTML = `
      <button class="cloth-card-del" onclick="removeClothItem('${itemDiv.id}')">✕</button>
      <div class="cloth-card-top">
        <div class="cloth-img-preview" style="background-image: url('${e.target.result}')"></div>
        <div>
          <label class="sub-info">사진 분류</label><br>
          <select class="select-box">
            <option value="wear">착용 사진</option>
            <option value="sizechart" selected>사이즈표 캡처</option>
          </select>
        </div>
      </div>

      <div class="field-section-title">카테고리</div>
      <div class="pill-group">
        <button class="pill active" onclick="selectPill(this)">상의</button>
        <button class="pill" onclick="selectPill(this)">하의</button>
        <button class="pill" onclick="selectPill(this)">원피스</button>
        <button class="pill" onclick="selectPill(this)">아우터</button>
        <button class="pill" onclick="selectPill(this)">모자</button>
        <button class="pill" onclick="selectPill(this)">신발</button>
      </div>

      <div class="field-section-title">사이즈 라벨</div>
      <div class="chip-group">
        <button class="chip" onclick="selectChip(this)">XXS</button>
        <button class="chip" onclick="selectChip(this)">XS</button>
        <button class="chip" onclick="selectChip(this)">S</button>
        <button class="chip" onclick="selectChip(this)">M</button>
        <button class="chip active" onclick="selectChip(this)">L</button>
        <button class="chip" onclick="selectChip(this)">XL</button>
        <button class="chip" onclick="selectChip(this)">XXL</button>
      </div>
    `;

    container.appendChild(itemDiv);
  };
  reader.readAsDataURL(file);

  // input 초기화
  event.target.value = '';
}

// 옷 업로드 항목 삭제
function removeClothItem(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// 알약형 버튼(카테고리) 단일 선택
function selectPill(btn) {
  const group = btn.parentElement;
  group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
}

// 칩 버튼(사이즈) 단일 선택
function selectChip(btn) {
  const group = btn.parentElement;
  group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

// 소형 칩 버튼 선택
function selectSmChip(btn) {
  const row = btn.parentElement;
  row.querySelectorAll('.chip-sm').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

// 선호 핏 선택
function selectPref(box) {
  const container = box.parentElement;
  container.querySelectorAll('.pref-box').forEach(b => b.classList.remove('active'));
  box.classList.add('active');
}

// 분석 실행 후 바로 마이페이지로 이동 처리 (분석 결과 화면 제거 반영)
function runAnalysisAndGoToMypage() {
  userRecordsCount++;
  
  // 마이페이지 기록 리스트 상단에 추가
  const container = document.getElementById('record-list-container');
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;

  const newRecord = document.createElement('div');
  newRecord.className = 'record-card';
  newRecord.innerHTML = `
    <div class="rec-head">
      <span>${dateStr} · 방금 전</span>
      <span class="dots">···</span>
    </div>
    <div class="rec-body">
      <div class="wire-x-box square-50"></div>
      <div>
        <h5>등록한 옷 분석 기록</h5>
        <div class="badge-group">
          <span class="badge">추천: L · 정핏</span>
          <span class="badge active">피드백 작성 중</span>
        </div>
        <p class="sub-info">신체 사이즈 기반 추천 완료</p>
      </div>
    </div>
    <div class="rec-actions">
      <button class="link-action" onclick="openSavedAnalysisModal('등록한 옷 분석 기록', 'L')">분석 결과 보기 ↗</button>
      <button class="link-action" onclick="navigateTo('size-input')">입력값 재사용</button>
      <button class="link-action text-del" onclick="deleteRecord(this)">삭제</button>
    </div>
  `;

  if (container.firstChild) {
    container.insertBefore(newRecord, container.firstChild);
  } else {
    container.appendChild(newRecord);
  }

  // 통계 업데이트
  document.getElementById('stat-count').innerText = `${userRecordsCount}건`;

  // 마이페이지로 이동 후 바로 결과 모달창 팝업
  navigateTo('mypage');
  openSavedAnalysisModal('등록한 옷 분석 기록', 'L');
}

// 분석 기록 삭제
function deleteRecord(btn) {
  const card = btn.closest('.record-card');
  if (card) {
    card.remove();
    userRecordsCount = Math.max(0, userRecordsCount - 1);
    document.getElementById('stat-count').innerText = `${userRecordsCount}건`;
  }
}

// 마이페이지 서브탭 Switch
function switchMypageTab(tabName) {
  const tabRecord = document.getElementById('mypage-tab-record');
  const tabProfile = document.getElementById('mypage-tab-profile');
  const btn1 = document.getElementById('mypage-subtab-1');
  const btn2 = document.getElementById('mypage-subtab-2');

  if (tabName === 'record') {
    tabRecord.classList.add('active');
    tabProfile.classList.remove('active');
    btn1.classList.add('active');
    btn2.classList.remove('active');
  } else {
    tabRecord.classList.remove('active');
    tabProfile.classList.add('active');
    btn1.classList.remove('active');
    btn2.classList.add('active');
  }
}

// 모달 다이얼로그 제어
function openSavedAnalysisModal(title = '유니클로 옥스포드 셔츠', recSize = 'L') {
  document.getElementById('modal-analysis-title').innerText = `${title} · ${recSize} · 정핏 기준`;
  document.getElementById('modal-rec-size').innerText = recSize;
  document.getElementById('modal-saved-analysis').classList.add('active');
}

function openSavedBrandModal() {
  document.getElementById('modal-saved-brand').classList.add('active');
}

function openAuthModal() {
  document.getElementById('modal-auth').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// 로그인 / 회원가입 탭 스위치
function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    formLogin.classList.remove('active');
    formSignup.classList.add('active');
  }
}

// 로그인 처리
function handleLogin() {
  const id = document.getElementById('login-id').value.trim();
  if (!id) {
    alert('아이디를 입력해주세요.');
    return;
  }

  currentUser = id.split('@')[0] || '사용자';
  updateUserHeader();
  closeModal('modal-auth');
  alert(`${currentUser}님, 환영합니다!`);
}

// 회원가입 처리
function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  if (!name) {
    alert('이름을 입력해주세요.');
    return;
  }

  currentUser = name;
  updateUserHeader();
  closeModal('modal-auth');
  alert(`${currentUser}님, 회원가입이 완료되었습니다!`);
}

// 헤더 UI 업데이트
function updateUserHeader() {
  const avatar = document.getElementById('avatar-text');
  const nameText = document.getElementById('user-name-text');

  if (currentUser) {
    avatar.innerText = currentUser.substring(0, 1);
    nameText.innerText = `${currentUser}님 ∨`;
  } else {
    avatar.innerText = '로그인';
    nameText.innerText = '로그인 / 가입';
  }
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
  // 기본 첫 옷 항목 1개 생성
  const initialFileInput = document.getElementById('cloth-file-input');
  if (initialFileInput) {
    // 스크립트 실행 준비 완료
  }
});
