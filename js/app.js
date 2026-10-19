/**
 * 핏센스 (FitSense) 메인 스크립트
 */

let currentUser = null;
let uploadedClothItems = [];
const sizeLabels = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

// 페이지 라우팅
function navigateTo(pageId) {
  const pages = document.querySelectorAll('.page-section');
  pages.forEach(p => p.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // 하단 탭 바 비주얼 업데이트
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const appBody = document.querySelector('.app-body');
  if (appBody) appBody.scrollTop = 0;
}

// 홈 카테고리 클릭 시 (사이즈 입력 진입 -> 1 신체 사이즈 단계 표시)
function selectCategory(category) {
  navigateTo('size-input');
  switchInputStep(1);
}

// 입력 단계 전환 (1. 신체 사이즈가 기본)
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

// 숫자와 소수점만 입력되도록 강제하는 함수
function sanitizeNumericInput(inputElement) {
  let val = inputElement.value;
  // 숫자와 . 을 제외한 문자 제거
  val = val.replace(/[^0-9.]/g, '');
  // 소수점 2개 이상 연속 입력 방지
  const parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }
  inputElement.value = val;
}

// 전신 사진 등록 시 미리보기 처리
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

// 옷 사진 다중 선택 시 카드로 렌더링
function handleClothPhotos(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const newItem = {
        id: Date.now() + Math.random(),
        imgSrc: e.target.result,
        category: '상의',
        photoType: '착용 사진',
        selectedSize: 'M'
      };
      uploadedClothItems.push(newItem);
      renderClothItems();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

// 사진별 정보 설정 UI 카드 생성
function renderClothItems() {
  const container = document.getElementById('cloth-items-container');
  container.innerHTML = '';

  uploadedClothItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'cloth-item-card';

    const categories = ['상의', '하의', '원피스', '아우터', '모자', '신발'];
    const catOptions = categories.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('');

    const sizeChips = sizeLabels.map(sz => 
      `<button type="button" class="chip ${item.selectedSize === sz ? 'active' : ''}" onclick="updateItemSize(${index}, '${sz}')">${sz}</button>`
    ).join('');

    card.innerHTML = `
      <div class="cloth-item-header">
        <strong>사진 ${index + 1}</strong>
        <button type="button" class="del-btn" onclick="removeClothItem(${index})">✕</button>
      </div>
      <div class="wire-x-box cloth-img-preview" style="background-image: url('${item.imgSrc}'); background-size: cover; background-position: center;"></div>
      
      <div class="form-row">
        <div class="form-field">
          <label>카테고리</label>
          <select class="select-box" onchange="updateItemCategory(${index}, this.value)">
            ${catOptions}
          </select>
        </div>
        <div class="form-field">
          <label>사진 구분</label>
          <select class="select-box" onchange="updateItemPhotoType(${index}, this.value)">
            <option ${item.photoType === '착용 사진' ? 'selected' : ''}>착용 사진</option>
            <option ${item.photoType === '사이즈표 캡처' ? 'selected' : ''}>사이즈표 캡처</option>
          </select>
        </div>
      </div>

      <div class="field-section-title">사이즈 라벨</div>
      <div class="chip-group">
        ${sizeChips}
      </div>
    `;
    container.appendChild(card);
  });
}

function updateItemCategory(index, val) { uploadedClothItems[index].category = val; }
function updateItemPhotoType(index, val) { uploadedClothItems[index].photoType = val; }
function updateItemSize(index, sz) {
  uploadedClothItems[index].selectedSize = sz;
  renderClothItems();
}
function removeClothItem(index) {
  uploadedClothItems.splice(index, 1);
  renderClothItems();
}

// 분석 실행 시 분석 결과 페이지를 거치지 않고 마이페이지 '분석 결과' 탭으로 바로 이동
function runAnalysisAndGoToMypage() {
  if (uploadedClothItems.length > 0) {
    const lastItem = uploadedClothItems[uploadedClothItems.length - 1];
    document.getElementById('res-cat-text').innerText = lastItem.category;
    document.getElementById('res-label-text').innerText = lastItem.selectedSize;
    document.getElementById('res-rec-size').innerText = lastItem.selectedSize;
  }
  
  navigateTo('mypage');
  switchMypageTab('analysis');
}

// 마이페이지 탭 Switch
function switchMypageTab(tabName) {
  const tabAnalysis = document.getElementById('mypage-tab-analysis');
  const tabRecord = document.getElementById('mypage-tab-record');
  const tabProfile = document.getElementById('mypage-tab-profile');
  
  const btn1 = document.getElementById('mypage-subtab-1');
  const btn2 = document.getElementById('mypage-subtab-2');
  const btn3 = document.getElementById('mypage-subtab-3');

  [tabAnalysis, tabRecord, tabProfile].forEach(el => el.classList.remove('active'));
  [btn1, btn2, btn3].forEach(el => el.classList.remove('active'));

  if (tabName === 'analysis') {
    tabAnalysis.classList.add('active');
    btn1.classList.add('active');
  } else if (tabName === 'record') {
    tabRecord.classList.add('active');
    btn2.classList.add('active');
  } else {
    tabProfile.classList.add('active');
    btn3.classList.add('active');
  }
}

// 모달 제어
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function openSavedBrandModal() {
  openModal('modal-saved-brand');
}

// 로그인/회원가입 탭
function switchAuthTab(type) {
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabSignup = document.getElementById('tab-btn-signup');

  if (type === 'login') {
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    formLogin.classList.remove('active');
    formSignup.classList.add('active');
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const name = email.split('@')[0];
  currentUser = { email, name };
  updateAuthUI();
  closeModal('modal-auth');
  alert(`${name}님 환영합니다!`);
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  currentUser = { email, name };
  updateAuthUI();
  closeModal('modal-auth');
  alert(`회원가입이 완료되었습니다. ${name}님 환영합니다!`);
}

function updateAuthUI() {
  const authArea = document.getElementById('header-auth-area');
  if (currentUser) {
    authArea.innerHTML = `<span class="user-profile-tag">${currentUser.name}님 ∨</span>`;
  } else {
    authArea.innerHTML = `<button class="auth-btn" onclick="openModal('modal-auth')">로그인/회원가입</button>`;
  }
}
