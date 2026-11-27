/* ═════════════════════════════════════════════════════════════
   뿡뿡이 기록 · 가족 장건강 노트
   - 이 기기(localStorage)에 먼저 저장 → 선택하면 가족 실시간 공유
   ═════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ───────── 기본값 ───────── */
  const STORE_KEY = 'bbung.v1';
  const WHO_KEY = 'bbung.who.v1';
  const SOUND_KEY = 'bbung.sound.v1';
  const SHARE_KEY = 'bbung.share.v1';
  const DIRTY_KEY = 'bbung.dirty.v1';

  const DEFAULT_FIREBASE_URL = 'https://baby-feeding-9f820-default-rtdb.asia-southeast1.firebasedatabase.app';
  const ROOM_ROOT = 'bbung_rooms';
  const APP_URL = 'https://bswjys.github.io/bbung-note/';
  const REQ_TIMEOUT = 8000;
  const POLL_MS = 5000;

  const FAMILY = [
    { id: 'mom', name: '엄마', emoji: '👩', face: '🌷', photo: './photos/mom.jpg' },
    { id: 'dad', name: '아빠', emoji: '👨', face: '🌿', photo: './photos/dad.jpg' },
    { id: 'sarang', name: '사랑', emoji: '🐥', face: '⭐', photo: './photos/sarang.jpg' },
    { id: 'harang', name: '하랑', emoji: '🐰', face: '🍑', photo: './photos/harang.jpg' },
  ];
  const CHARACTER_SRC = './character.svg';

  const STAGES = [
    { id: 'triple', label: '뿡뿡뿡', puffs: '💨💨💨', desc: '묵직하게', bg: '#FFD9C2', ink: '#B96A45', solid: '#F6A97E' },
    { id: 'double', label: '뿡뿡', puffs: '💨💨', desc: '통통', bg: '#FFEFC6', ink: '#B08A3B', solid: '#E4B85C' },
    { id: 'single', label: '뿡', puffs: '💨', desc: '앙증맞게', bg: '#E7DEFB', ink: '#8A76BC', solid: '#A992DA' },
    { id: 'calm', label: '편안', puffs: '🌿', desc: '산뜻하게', bg: '#D6F0E3', ink: '#4E9179', solid: '#6CC2A4' },
  ];
  const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));

  const TONES = ['peach', 'mint', 'lilac', 'butter', 'rose', 'sky'];

  /* ───────── 음식 사전 (387종 · 사진 그림 32종) ───────── */
  const FOODS = [
    // 가스가 생기기 쉬운 음식 · 채소와 기본 재료
    { n: '양파', e: '🧅', c: 'gas', t: 'peach' },
    { n: '마늘', e: '🧄', c: 'gas', t: 'peach' },
    { n: '대파', e: '🌱', c: 'gas', t: 'mint' },
    { n: '부추', e: '🌿', c: 'gas', t: 'mint' },
    { n: '마늘종', e: '🌱', c: 'gas', t: 'mint' },
    { n: '쪽파', e: '🌱', c: 'gas', t: 'mint' },
    { n: '실파', e: '🌱', c: 'gas', t: 'mint' },
    { n: '양파즙', e: '🧅', c: 'gas', t: 'peach' },
    { n: '생강', e: '🫚', c: 'gas', t: 'butter' },
    { n: '콩', e: '🫘', c: 'gas', t: 'peach' },
    { n: '콩나물', e: '🌱', c: 'gas', t: 'mint', p: 'kongnamul' },
    { n: '두부', e: '🍥', c: 'gas', t: 'butter', p: 'dubu' },
    { n: '두부부침', e: '🍥', c: 'gas', t: 'butter', p: 'dubu' },
    { n: '두부조림', e: '🍥', c: 'gas', t: 'butter', p: 'dubu' },
    { n: '두부김치', e: '🍥', c: 'gas', t: 'rose', p: 'dubu' },
    { n: '순두부', e: '🍲', c: 'gas', t: 'butter' },
    { n: '된장찌개', e: '🍲', c: 'gas', t: 'peach', p: 'doenjang-jjigae' },
    { n: '된장국', e: '🍲', c: 'gas', t: 'butter' },
    { n: '청국장', e: '🍲', c: 'gas', t: 'peach' },
    { n: '순두부찌개', e: '🍲', c: 'gas', t: 'rose' },
    { n: '비지찌개', e: '🍲', c: 'gas', t: 'butter' },
    { n: '김치', e: '🥬', c: 'gas', t: 'rose' },
    { n: '깍두기', e: '🥕', c: 'gas', t: 'rose' },
    { n: '총각김치', e: '🥕', c: 'gas', t: 'rose' },
    { n: '열무김치', e: '🥬', c: 'gas', t: 'mint' },
    { n: '백김치', e: '🥬', c: 'gas', t: 'butter' },
    { n: '나박김치', e: '🥬', c: 'gas', t: 'rose' },
    { n: '파김치', e: '🌱', c: 'gas', t: 'mint' },
    { n: '오이소박이', e: '🥒', c: 'gas', t: 'mint' },
    { n: '깻잎장아찌', e: '🌿', c: 'gas', t: 'mint' },
    { n: '장아찌', e: '🥒', c: 'gas', t: 'butter' },
    { n: '배추', e: '🥬', c: 'gas', t: 'mint' },
    { n: '브로콜리', e: '🥦', c: 'gas', t: 'mint' },
    { n: '양배추', e: '🥬', c: 'gas', t: 'mint' },
    { n: '콜리플라워', e: '🥦', c: 'gas', t: 'mint' },
    { n: '케일', e: '🥬', c: 'gas', t: 'mint' },
    { n: '고구마', e: '🍠', c: 'gas', t: 'peach' },
    { n: '감자', e: '🥔', c: 'gas', t: 'butter' },
    { n: '옥수수', e: '🌽', c: 'gas', t: 'butter' },
    { n: '밤', e: '🌰', c: 'gas', t: 'butter' },
    { n: '은행', e: '🌰', c: 'gas', t: 'butter' },
    { n: '도토리', e: '🌰', c: 'gas', t: 'butter' },
    { n: '아이스크림', e: '🍨', c: 'gas', t: 'rose' },
    { n: '빵', e: '🍞', c: 'gas', t: 'butter' },
    { n: '떡', e: '🍡', c: 'gas', t: 'lilac' },
    { n: '라면', e: '🍜', c: 'gas', t: 'peach' },
    { n: '라볶이', e: '🍜', c: 'gas', t: 'rose' },
    { n: '국수', e: '🍜', c: 'gas', t: 'butter' },
    { n: '맥주', e: '🍺', c: 'gas', t: 'butter' },
    { n: '콜라', e: '🥤', c: 'gas', t: 'rose' },
    { n: '사이다', e: '🥤', c: 'gas', t: 'sky' },
    { n: '탄산수', e: '💧', c: 'gas', t: 'sky' },
    { n: '이온음료', e: '🥤', c: 'gas', t: 'sky' },
    { n: '햄버거', e: '🍔', c: 'gas', t: 'peach' },
    { n: '피자', e: '🍕', c: 'gas', t: 'rose' },
    { n: '감자튀김', e: '🍟', c: 'gas', t: 'butter' },
    { n: '튀김', e: '🍤', c: 'gas', t: 'peach' },
    { n: '치킨', e: '🍗', c: 'gas', t: 'peach' },
    { n: '삼겹살', e: '🥓', c: 'gas', t: 'rose', p: 'samgyeopsal' },
    { n: '소고기', e: '🥩', c: 'gas', t: 'rose' },
    { n: '돼지고기', e: '🥩', c: 'gas', t: 'rose' },
    { n: '불고기', e: '🥩', c: 'gas', t: 'peach' },
    { n: '갈비', e: '🥩', c: 'gas', t: 'rose' },
    { n: '닭고기', e: '🍗', c: 'gas', t: 'peach' },
    { n: '닭갈비', e: '🍗', c: 'gas', t: 'rose' },
    { n: '닭가슴살', e: '🍗', c: 'gas', t: 'mint' },
    { n: '계란', e: '🥚', c: 'gas', t: 'butter' },
    { n: '삶은계란', e: '🥚', c: 'gas', t: 'butter' },
    { n: '계란후라이', e: '🍳', c: 'gas', t: 'butter' },
    { n: '메추리알', e: '🥚', c: 'gas', t: 'butter' },
    { n: '버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '표고버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '느타리버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '새송이버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '팽이버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '양송이버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '송이버섯', e: '🍄', c: 'gas', t: 'butter' },
    { n: '목이버섯', e: '🍄', c: 'gas', t: 'lilac' },
    { n: '미역', e: '🍲', c: 'gas', t: 'mint' },
    { n: '다시마', e: '🍲', c: 'gas', t: 'mint' },
    { n: '김', e: '🍙', c: 'gas', t: 'butter', p: 'gim' },
    { n: '팥', e: '🫘', c: 'gas', t: 'rose' },
    { n: '콩자반', e: '🫘', c: 'gas', t: 'butter' },
    { n: '땅콩', e: '🥜', c: 'gas', t: 'butter' },
    { n: '아몬드', e: '🌰', c: 'gas', t: 'butter' },
    { n: '호두', e: '🌰', c: 'gas', t: 'butter' },
    { n: '잣', e: '🌰', c: 'gas', t: 'butter' },
    { n: '깨', e: '🌰', c: 'gas', t: 'butter' },
    { n: '우유', e: '🥛', c: 'gas', t: 'sky' },
    { n: '치즈', e: '🧀', c: 'gas', t: 'butter' },
    { n: '유제품', e: '🥛', c: 'gas', t: 'sky' },
    { n: '요구르트', e: '🍦', c: 'gas', t: 'sky' },
    { n: '시리얼', e: '🥣', c: 'gas', t: 'butter' },
    { n: '그래놀라', e: '🥣', c: 'gas', t: 'butter' },

    // 과일 · 열매
    { n: '사과', e: '🍎', c: 'gas', t: 'rose' },
    { n: '배', e: '🍐', c: 'gas', t: 'mint' },
    { n: '복숭아', e: '🍑', c: 'gas', t: 'rose' },
    { n: '천도복숭아', e: '🍑', c: 'gas', t: 'rose' },
    { n: '자두', e: '🍑', c: 'gas', t: 'lilac', p: 'jadu' },
    { n: '푸룬', e: '🫐', c: 'gas', t: 'lilac' },
    { n: '살구', e: '🍑', c: 'gas', t: 'butter', p: 'salgu' },
    { n: '앵두', e: '🍒', c: 'gas', t: 'rose' },
    { n: '수박', e: '🍉', c: 'gas', t: 'rose' },
    { n: '멜론', e: '🍈', c: 'gas', t: 'mint' },
    { n: '참외', e: '🍈', c: 'gas', t: 'butter', p: 'chamoe' },
    { n: '딸기', e: '🍓', c: 'gas', t: 'rose' },
    { n: '포도', e: '🍇', c: 'gas', t: 'lilac' },
    { n: '건포도', e: '🍇', c: 'gas', t: 'butter' },
    { n: '체리', e: '🍒', c: 'gas', t: 'rose' },
    { n: '키위', e: '🥝', c: 'gas', t: 'mint' },
    { n: '골드키위', e: '🥝', c: 'gas', t: 'butter' },
    { n: '블루베리', e: '🫐', c: 'gas', t: 'lilac' },
    { n: '오디', e: '🫐', c: 'gas', t: 'lilac' },
    { n: '복분자', e: '🫐', c: 'gas', t: 'lilac' },
    { n: '라즈베리', e: '🫐', c: 'gas', t: 'rose' },
    { n: '크랜베리', e: '🫐', c: 'gas', t: 'rose' },
    { n: '무화과', e: '🍈', c: 'gas', t: 'lilac', p: 'muhwagwa' },
    { n: '석류', e: '🍎', c: 'gas', t: 'rose', p: 'seongnyu' },
    { n: '감', e: '🍊', c: 'gas', t: 'rose', p: 'gam' },
    { n: '대추', e: '🌰', c: 'gas', t: 'butter', p: 'daechu' },
    { n: '매실', e: '🍏', c: 'gas', t: 'mint', p: 'maesil' },
    { n: '바나나', e: '🍌', c: 'gas', t: 'butter' },
    { n: '망고', e: '🥭', c: 'gas', t: 'butter' },
    { n: '파파야', e: '🥭', c: 'gas', t: 'peach' },
    { n: '파인애플', e: '🍍', c: 'gas', t: 'butter' },
    { n: '코코넛', e: '🥥', c: 'gas', t: 'butter' },
    { n: '리치', e: '🍒', c: 'gas', t: 'rose' },
    { n: '용과', e: '🍈', c: 'gas', t: 'rose' },
    { n: '오렌지', e: '🍊', c: 'gas', t: 'peach' },
    { n: '귤', e: '🍊', c: 'gas', t: 'peach' },
    { n: '금귤', e: '🍊', c: 'gas', t: 'butter' },
    { n: '유자', e: '🍊', c: 'gas', t: 'butter' },
    { n: '자몽', e: '🍊', c: 'gas', t: 'peach' },
    { n: '레몬', e: '🍋', c: 'gas', t: 'butter' },
    { n: '라임', e: '🍋', c: 'gas', t: 'mint' },
    { n: '토마토', e: '🍅', c: 'gas', t: 'rose' },
    { n: '방울토마토', e: '🍅', c: 'gas', t: 'rose' },
    { n: '아보카도', e: '🥑', c: 'gas', t: 'mint' },
    { n: '과일샐러드', e: '🥗', c: 'gas', t: 'rose' },
    { n: '아로니아', e: '🫐', c: 'gas', t: 'lilac' },

    // 채소 · 나물
    { n: '오이', e: '🥒', c: 'gas', t: 'mint', p: 'oi' },
    { n: '애호박', e: '🥒', c: 'gas', t: 'mint', p: 'aehobak' },
    { n: '단호박', e: '🎃', c: 'gas', t: 'butter' },
    { n: '호박', e: '🎃', c: 'gas', t: 'butter' },
    { n: '가지', e: '🍆', c: 'gas', t: 'lilac' },
    { n: '무', e: '🥬', c: 'gas', t: 'butter' },
    { n: '총각무', e: '🥬', c: 'gas', t: 'mint' },
    { n: '열무', e: '🥬', c: 'gas', t: 'mint' },
    { n: '우엉', e: '🥕', c: 'gas', t: 'butter' },
    { n: '연근', e: '🥔', c: 'gas', t: 'butter' },
    { n: '도라지', e: '🥕', c: 'gas', t: 'butter' },
    { n: '더덕', e: '🥕', c: 'gas', t: 'butter' },
    { n: '토란', e: '🥔', c: 'gas', t: 'butter' },
    { n: '마', e: '🥔', c: 'gas', t: 'butter' },
    { n: '비트', e: '🥕', c: 'gas', t: 'rose' },
    { n: '아스파라거스', e: '🌱', c: 'gas', t: 'mint' },
    { n: '죽순', e: '🎋', c: 'gas', t: 'butter' },
    { n: '여주', e: '🥒', c: 'gas', t: 'mint' },
    { n: '오크라', e: '🥒', c: 'gas', t: 'mint' },
    { n: '시금치', e: '🥬', c: 'gas', t: 'mint', p: 'sigeumchi' },
    { n: '시금치나물', e: '🥬', c: 'gas', t: 'mint', p: 'sigeumchi' },
    { n: '콩나물무침', e: '🥬', c: 'gas', t: 'mint', p: 'kongnamul' },
    { n: '상추', e: '🥬', c: 'gas', t: 'mint' },
    { n: '양상추', e: '🥬', c: 'gas', t: 'mint' },
    { n: '로메인', e: '🥬', c: 'gas', t: 'mint' },
    { n: '청경채', e: '🥬', c: 'gas', t: 'mint' },
    { n: '근대', e: '🥬', c: 'gas', t: 'mint' },
    { n: '깻잎', e: '🌿', c: 'gas', t: 'mint' },
    { n: '고사리', e: '🌿', c: 'gas', t: 'mint' },
    { n: '취나물', e: '🌿', c: 'gas', t: 'mint' },
    { n: '쑥갓', e: '🌿', c: 'gas', t: 'mint' },
    { n: '미나리', e: '🌿', c: 'gas', t: 'mint' },
    { n: '냉이', e: '🌿', c: 'gas', t: 'mint' },
    { n: '달래', e: '🌿', c: 'gas', t: 'mint' },
    { n: '도라지무침', e: '🌿', c: 'gas', t: 'butter' },
    { n: '파프리카', e: '🫑', c: 'gas', t: 'mint' },
    { n: '피망', e: '🫑', c: 'gas', t: 'mint' },
    { n: '고추', e: '🌶️', c: 'gas', t: 'rose' },
    { n: '청양고추', e: '🌶️', c: 'gas', t: 'rose' },
    { n: '꽈리고추', e: '🌶️', c: 'gas', t: 'rose' },
    { n: '오이고추', e: '🌶️', c: 'gas', t: 'mint' },
    { n: '할라피뇨', e: '🌶️', c: 'gas', t: 'mint' },
    { n: '당근', e: '🥕', c: 'gas', t: 'peach' },
    { n: '단무지', e: '🥕', c: 'gas', t: 'butter' },
    { n: '절임', e: '🥒', c: 'gas', t: 'mint' },
    { n: '무말랭이', e: '🥬', c: 'gas', t: 'butter' },
    { n: '콩나물국', e: '🍲', c: 'gas', t: 'mint' },

    // 속이 편한 음식
    { n: '쌀밥', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '현미밥', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '잡곡밥', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '보리밥', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '콩밥', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '죽', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '흰죽', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '미음', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '전복죽', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '야채죽', e: '🥣', c: 'gentle', t: 'mint' },
    { n: '닭죽', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '팥죽', e: '🥣', c: 'gentle', t: 'rose' },
    { n: '호박죽', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '오트밀', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '누룽지', e: '🍚', c: 'gentle', t: 'butter' },
    { n: '두유', e: '🥛', c: 'gentle', t: 'mint' },
    { n: '귀리우유', e: '🥛', c: 'gentle', t: 'butter' },
    { n: '아몬드유', e: '🥛', c: 'gentle', t: 'butter' },
    { n: '따뜻한물', e: '💧', c: 'gentle', t: 'sky' },
    { n: '생강차', e: '🫚', c: 'gentle', t: 'butter' },
    { n: '캐모마일차', e: '🍵', c: 'gentle', t: 'mint' },
    { n: '녹차', e: '🍵', c: 'gentle', t: 'mint' },
    { n: '보리차', e: '🍵', c: 'gentle', t: 'butter' },
    { n: '현미녹차', e: '🍵', c: 'gentle', t: 'butter' },
    { n: '매실차', e: '🍵', c: 'gentle', t: 'mint' },
    { n: '쑥차', e: '🍵', c: 'gentle', t: 'mint' },
    { n: '대추차', e: '🍵', c: 'gentle', t: 'butter' },
    { n: '유자차', e: '🍵', c: 'gentle', t: 'butter' },
    { n: '인삼차', e: '🍵', c: 'gentle', t: 'butter' },
    { n: '과일차', e: '🍵', c: 'gentle', t: 'peach' },
    { n: '흰살생선', e: '🐟', c: 'gentle', t: 'sky' },
    { n: '연어', e: '🐟', c: 'gentle', t: 'peach' },
    { n: '감자수프', e: '🥣', c: 'gentle', t: 'butter' },
    { n: '크래커', e: '🍘', c: 'gentle', t: 'butter' },
    { n: '토스트', e: '🍞', c: 'gentle', t: 'butter' },
    { n: '식혜', e: '🥤', c: 'gentle', t: 'butter' },
    { n: '수정과', e: '🥤', c: 'gentle', t: 'butter' },
    { n: '미역국', e: '🍲', c: 'gentle', t: 'mint', p: 'miyeokguk' },
    { n: '북엇국', e: '🍲', c: 'gentle', t: 'sky' },
    { n: '계란찜', e: '🍳', c: 'gentle', t: 'butter' },
    { n: '데친나물', e: '🥬', c: 'gentle', t: 'mint' },
    { n: '바나나우유', e: '🥛', c: 'gentle', t: 'butter' },
    { n: '감자국', e: '🍲', c: 'gentle', t: 'butter' },
    { n: '계란탕', e: '🍳', c: 'gentle', t: 'butter' },
    { n: '푸딩', e: '🍮', c: 'gentle', t: 'butter' },
    { n: '양갱', e: '🍡', c: 'gentle', t: 'lilac' },

    // 그냥저냥 살펴보는 음식
    { n: '김밥', e: '🍙', c: 'neutral', t: 'lilac', p: 'gimbap' },
    { n: '주먹밥', e: '🍙', c: 'neutral', t: 'mint' },
    { n: '김말이', e: '🍙', c: 'neutral', t: 'butter' },
    { n: '초밥', e: '🍣', c: 'neutral', t: 'sky' },
    { n: '떡볶이', e: '🍢', c: 'neutral', t: 'peach', p: 'tteokbokki' },
    { n: '떡꼬치', e: '🍢', c: 'neutral', t: 'rose' },
    { n: '순대', e: '🍢', c: 'neutral', t: 'lilac' },
    { n: '붕어빵', e: '🐟', c: 'neutral', t: 'butter' },
    { n: '호떡', e: '🥞', c: 'neutral', t: 'butter' },
    { n: '계란빵', e: '🥚', c: 'neutral', t: 'butter' },
    { n: '만두', e: '🥟', c: 'neutral', t: 'lilac' },
    { n: '군만두', e: '🥟', c: 'neutral', t: 'butter' },
    { n: '찐만두', e: '🥟', c: 'neutral', t: 'lilac' },
    { n: '인절미', e: '🍡', c: 'neutral', t: 'butter' },
    { n: '송편', e: '🍡', c: 'neutral', t: 'mint' },
    { n: '찹쌀떡', e: '🍡', c: 'neutral', t: 'rose' },
    { n: '약과', e: '🍪', c: 'neutral', t: 'butter' },
    { n: '한과', e: '🍪', c: 'neutral', t: 'butter' },
    { n: '냉면', e: '🍜', c: 'neutral', t: 'sky', p: 'naengmyeon' },
    { n: '막국수', e: '🍜', c: 'neutral', t: 'sky' },
    { n: '콩국수', e: '🍜', c: 'neutral', t: 'butter' },
    { n: '비빔국수', e: '🍜', c: 'neutral', t: 'rose' },
    { n: '잔치국수', e: '🍜', c: 'neutral', t: 'butter' },
    { n: '쫄면', e: '🍜', c: 'neutral', t: 'rose' },
    { n: '소바', e: '🍜', c: 'neutral', t: 'butter' },
    { n: '칼국수', e: '🍜', c: 'neutral', t: 'butter', p: 'kalguksu' },
    { n: '짜장면', e: '🍜', c: 'neutral', t: 'peach', p: 'jjajangmyeon' },
    { n: '짬뽕', e: '🍜', c: 'neutral', t: 'peach' },
    { n: '우동', e: '🍜', c: 'neutral', t: 'sky' },
    { n: '비빔밥', e: '🍚', c: 'neutral', t: 'mint', p: 'bibimbap' },
    { n: '볶음밥', e: '🍚', c: 'neutral', t: 'butter' },
    { n: '김치볶음밥', e: '🍚', c: 'neutral', t: 'rose' },
    { n: '덮밥', e: '🍚', c: 'neutral', t: 'peach' },
    { n: '리조또', e: '🍚', c: 'neutral', t: 'butter' },
    { n: '카레', e: '🍛', c: 'neutral', t: 'butter' },
    { n: '탕수육', e: '🍖', c: 'neutral', t: 'peach' },
    { n: '돈까스', e: '🍱', c: 'neutral', t: 'butter' },
    { n: '삼계탕', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '갈비탕', e: '🍲', c: 'neutral', t: 'peach' },
    { n: '설렁탕', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '곰탕', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '감자탕', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '육개장', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '김치찌개', e: '🍲', c: 'neutral', t: 'rose', p: 'kimchi-jjigae' },
    { n: '순대국', e: '🍲', c: 'neutral', t: 'butter', p: 'sundaeguk' },
    { n: '부대찌개', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '동태찌개', e: '🍲', c: 'neutral', t: 'sky' },
    { n: '알탕', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '매운탕', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '추어탕', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '떡국', e: '🍲', c: 'neutral', t: 'butter', p: 'tteokguk' },
    { n: '만둣국', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '떡만둣국', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '시래기국', e: '🍲', c: 'neutral', t: 'mint' },
    { n: '마라탕', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '마라샹궈', e: '🍲', c: 'neutral', t: 'rose' },
    { n: '잡채', e: '🍲', c: 'neutral', t: 'lilac', p: 'japchae' },
    { n: '당면', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '갈비찜', e: '🍖', c: 'neutral', t: 'rose', p: 'galbijjim' },
    { n: '전', e: '🥘', c: 'neutral', t: 'butter', p: 'buchimgae' },
    { n: '부침개', e: '🥘', c: 'neutral', t: 'butter', p: 'buchimgae' },
    { n: '계란말이', e: '🍳', c: 'neutral', t: 'butter', p: 'gyeranmari' },
    { n: '오므라이스', e: '🍳', c: 'neutral', t: 'peach' },
    { n: '오믈렛', e: '🍳', c: 'neutral', t: 'butter' },
    { n: '장조림', e: '🥩', c: 'neutral', t: 'butter' },
    { n: '감자조림', e: '🥔', c: 'neutral', t: 'butter' },
    { n: '보쌈', e: '🥩', c: 'neutral', t: 'rose' },
    { n: '족발', e: '🥩', c: 'neutral', t: 'rose' },
    { n: '제육볶음', e: '🥩', c: 'neutral', t: 'rose' },
    { n: '양꼬치', e: '🍢', c: 'neutral', t: 'peach' },
    { n: '스테이크', e: '🥩', c: 'neutral', t: 'rose' },
    { n: '바비큐', e: '🍖', c: 'neutral', t: 'peach' },
    { n: '햄', e: '🥓', c: 'neutral', t: 'rose' },
    { n: '베이컨', e: '🥓', c: 'neutral', t: 'rose' },
    { n: '소시지', e: '🌭', c: 'neutral', t: 'peach' },
    { n: '너겟', e: '🍗', c: 'neutral', t: 'butter' },
    { n: '어묵', e: '🍢', c: 'neutral', t: 'butter', p: 'eomuk' },
    { n: '어묵볶음', e: '🍢', c: 'neutral', t: 'butter', p: 'eomuk' },
    { n: '맛살', e: '🦀', c: 'neutral', t: 'rose' },
    { n: '진미채', e: '🦑', c: 'neutral', t: 'rose' },
    { n: '멸치볶음', e: '🐟', c: 'neutral', t: 'butter' },
    { n: '고등어', e: '🐟', c: 'neutral', t: 'sky', p: 'godeungeo' },
    { n: '갈치', e: '🐟', c: 'neutral', t: 'sky' },
    { n: '조기', e: '🐟', c: 'neutral', t: 'butter' },
    { n: '굴비', e: '🐟', c: 'neutral', t: 'butter' },
    { n: '삼치', e: '🐟', c: 'neutral', t: 'sky' },
    { n: '꽁치', e: '🐟', c: 'neutral', t: 'sky' },
    { n: '멸치', e: '🐟', c: 'neutral', t: 'butter' },
    { n: '참치', e: '🐟', c: 'neutral', t: 'rose' },
    { n: '오징어', e: '🦑', c: 'neutral', t: 'sky' },
    { n: '낙지', e: '🐙', c: 'neutral', t: 'rose' },
    { n: '문어', e: '🐙', c: 'neutral', t: 'lilac' },
    { n: '주꾸미', e: '🐙', c: 'neutral', t: 'rose' },
    { n: '새우', e: '🦐', c: 'neutral', t: 'peach' },
    { n: '꽃게', e: '🦀', c: 'neutral', t: 'rose' },
    { n: '간장게장', e: '🦀', c: 'neutral', t: 'rose' },
    { n: '양념게장', e: '🦀', c: 'neutral', t: 'rose' },
    { n: '조개', e: '🦪', c: 'neutral', t: 'sky' },
    { n: '홍합', e: '🦪', c: 'neutral', t: 'lilac' },
    { n: '전복', e: '🦪', c: 'neutral', t: 'butter' },
    { n: '굴', e: '🦪', c: 'neutral', t: 'sky' },
    { n: '해삼', e: '🦪', c: 'neutral', t: 'butter' },
    { n: '젓갈', e: '🐟', c: 'neutral', t: 'rose' },
    { n: '새우젓', e: '🦐', c: 'neutral', t: 'rose' },
    { n: '명란젓', e: '🐟', c: 'neutral', t: 'rose' },
    { n: '도넛', e: '🍩', c: 'neutral', t: 'rose' },
    { n: '케이크', e: '🍰', c: 'neutral', t: 'rose' },
    { n: '머핀', e: '🧁', c: 'neutral', t: 'butter' },
    { n: '마카롱', e: '🍪', c: 'neutral', t: 'lilac' },
    { n: '쿠키', e: '🍪', c: 'neutral', t: 'butter' },
    { n: '와플', e: '🧇', c: 'neutral', t: 'butter' },
    { n: '팬케이크', e: '🥞', c: 'neutral', t: 'butter' },
    { n: '초콜릿', e: '🍫', c: 'neutral', t: 'lilac' },
    { n: '사탕', e: '🍬', c: 'neutral', t: 'rose' },
    { n: '캐러멜', e: '🍬', c: 'neutral', t: 'butter' },
    { n: '젤리', e: '🍬', c: 'neutral', t: 'lilac' },
    { n: '팥빙수', e: '🍧', c: 'neutral', t: 'rose' },
    { n: '빙수', e: '🍧', c: 'neutral', t: 'sky' },
    { n: '팝콘', e: '🍿', c: 'neutral', t: 'butter' },
    { n: '감자칩', e: '🍟', c: 'neutral', t: 'butter' },
    { n: '크루아상', e: '🥐', c: 'neutral', t: 'butter' },
    { n: '베이글', e: '🥯', c: 'neutral', t: 'butter' },
    { n: '샌드위치', e: '🥪', c: 'neutral', t: 'mint' },
    { n: '핫도그', e: '🌭', c: 'neutral', t: 'peach' },
    { n: '부리토', e: '🌯', c: 'neutral', t: 'butter' },
    { n: '퀘사디아', e: '🫓', c: 'neutral', t: 'butter' },
    { n: '타코', e: '🌮', c: 'neutral', t: 'butter' },
    { n: '파스타', e: '🍝', c: 'neutral', t: 'peach' },
    { n: '그라탕', e: '🧀', c: 'neutral', t: 'butter' },
    { n: '샐러드', e: '🥗', c: 'neutral', t: 'mint' },
    { n: '스프', e: '🥣', c: 'neutral', t: 'butter' },
    { n: '커피', e: '☕', c: 'neutral', t: 'lilac' },
    { n: '아메리카노', e: '☕', c: 'neutral', t: 'lilac' },
    { n: '아이스커피', e: '☕', c: 'neutral', t: 'sky' },
    { n: '카페라떼', e: '☕', c: 'neutral', t: 'butter' },
    { n: '녹차라떼', e: '🍵', c: 'neutral', t: 'butter' },
    { n: '밀크티', e: '🧋', c: 'neutral', t: 'butter' },
    { n: '버블티', e: '🧋', c: 'neutral', t: 'lilac' },
    { n: '요거트', e: '🍦', c: 'neutral', t: 'sky' },
    { n: '과일주스', e: '🧃', c: 'neutral', t: 'peach' },
    { n: '주스', e: '🧃', c: 'neutral', t: 'peach' },
    { n: '소주', e: '🍶', c: 'neutral', t: 'sky' },
    { n: '막걸리', e: '🍶', c: 'neutral', t: 'butter' },
    { n: '와인', e: '🍷', c: 'neutral', t: 'rose' },
    { n: '고추장', e: '🌶️', c: 'neutral', t: 'rose' },
    { n: '된장', e: '🍲', c: 'neutral', t: 'butter' },
    { n: '간장', e: '🍶', c: 'neutral', t: 'butter' },
    { n: '참기름', e: '🫗', c: 'neutral', t: 'butter' },
    { n: '들기름', e: '🫗', c: 'neutral', t: 'butter' },
    { n: '소금', e: '🧂', c: 'neutral', t: 'butter' },
    { n: '설탕', e: '🍬', c: 'neutral', t: 'butter' },
    { n: '마요네즈', e: '🥚', c: 'neutral', t: 'butter' },
    { n: '케첩', e: '🍅', c: 'neutral', t: 'rose' },
    { n: '머스터드', e: '🍋', c: 'neutral', t: 'butter' },
  ];

  /* ───────── 음식 그림(foods/*.webp) — 이모지로는 어색한 한국 음식·과일 32종 ───────── */
  const PIC_NAMES = {
    chamoe: '참외', jadu: '자두', gam: '감', muhwagwa: '무화과',
    seongnyu: '석류', salgu: '살구', daechu: '대추', maesil: '매실',
    oi: '오이', aehobak: '애호박', kongnamul: '콩나물', sigeumchi: '시금치',
    dubu: '두부', gim: '김', eomuk: '어묵', godeungeo: '고등어',
    'kimchi-jjigae': '김치찌개', 'doenjang-jjigae': '된장찌개', miyeokguk: '미역국', sundaeguk: '순대국',
    gimbap: '김밥', tteokbokki: '떡볶이', tteokguk: '떡국', samgyeopsal: '삼겹살',
    bibimbap: '비빔밥', naengmyeon: '냉면', jjajangmyeon: '짜장면', kalguksu: '칼국수',
    buchimgae: '부침개', gyeranmari: '계란말이', japchae: '잡채', galbijjim: '갈비찜',
  };
  const PIC_ORDER = Object.keys(PIC_NAMES);
  const picSrc = (slug) => (slug ? `./foods/${slug}.webp` : '');

  /* ───────── 비슷한 말 사전 — 이름이 조금 달라도 가까운 음식 그림으로 ───────── */
  const ALIASES = {
    // 과일
    샤인머스캣: '포도', 샤인머스켓: '포도', 청포도: '포도', 거봉: '포도', 적포도: '포도', 캠벨포도: '포도', 포도주스: '포도',
    한라봉: '귤', 천혜향: '귤', 레드향: '귤', 감귤: '귤', 밀감: '귤',
    대추토마토: '토마토', 스테비아토마토: '토마토', 토마토주스: '토마토',
    수박화채: '수박', 수박주스: '수박',
    홍시: '감', 곶감: '감', 단감: '감', 반건시: '감',
    자두주스: '자두', 복숭아주스: '복숭아',
    // 계란
    달걀: '계란', 계란프라이: '계란후라이', 에그: '계란후라이', 흰자: '계란', 노른자: '계란',
    // 커피·음료
    라떼: '카페라떼', 에스프레소: '커피', 모카: '커피', 카푸치노: '커피', 콜드브루: '커피',
    아아: '아이스커피', 아이스아메리카노: '아이스커피', 아샷추: '아이스커피',
    홍차: '녹차', 우롱차: '녹차', 국화차: '캐모마일차',
    물: '따뜻한물', 생수: '따뜻한물', 미지근한물: '따뜻한물',
    요플레: '요거트', 그릭요거트: '요거트', 플레인요거트: '요거트',
    사과주스: '사과', 오렌지주스: '오렌지', 딸기주스: '딸기', 배주스: '배',
    // 고추·채소
    청양고추: '고추', 오이고추: '고추', 꽈리고추: '고추', 홍고추: '고추', 풋고추: '고추', 고춧가루: '고추', 고추가루: '고추',
    // 고기
    백숙: '닭고기', 닭백숙: '닭고기', 영계백숙: '닭고기', 통닭: '치킨', 후라이드: '치킨', 양념치킨: '치킨',
    닭볶음탕: '닭갈비', 닭도리탕: '닭갈비',
    돼지고기: '돼지고기', 보쌈: '돼지고기', 족발: '돼지고기', 제육볶음: '돼지고기', 수육: '돼지고기',
    삼겹: '삼겹살', 오겹살: '삼겹살', 목살: '삼겹살', 항정살: '삼겹살', 갈매기살: '삼겹살', 대패삼겹살: '삼겹살',
    돈가스: '돈까스', 돈부리: '덮밥',
    // 분식·국
    오뎅: '어묵', 어묵국: '어묵', 어묵탕: '어묵',
    김치찌게: '김치찌개', 된장찌게: '된장찌개', 순두부찌게: '순두부찌개', 부대찌게: '부대찌개',
    떡만두국: '떡만둣국', 만두국: '만둣국',
    컵라면: '라면', 봉지라면: '라면', 삼각김밥: '주먹밥',
    // 양념·기타
    들깨: '깨', 통깨: '깨', 참깨: '깨', 올리브유: '들기름', 식용유: '참기름',
  };

  const EMOJI_PALETTE = [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🥭', '🍍',
    '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🧅', '🧄', '🫘', '🍄',
    '🥔', '🍠', '🎃', '🥚', '🍗', '🥩', '🥓', '🐟', '🍤', '🍥', '🥛', '🧀',
    '🍚', '🍞', '🥐', '🍜', '🍲', '🥣', '🍙', '🍣', '🍕', '🍔', '🍟', '🍰',
    '🍪', '🍩', '🍫', '☕', '🍵', '🥤', '💧', '🌿', '🍽️',
  ];

  /* ───────── 오늘의 건강 일기 TIP (18일 순환) ───────── */
  const TIPS = [
    { t: '양파는 익혀서', items: ['생양파·마늘·콩류는 가스를 많이 만들어요', '익힌 애호박·단호박은 속이 편해요', '한 번에 많이 먹지 말고 천천히 드세요'], foot: '익히면 매운 성분이 줄어 편해져요' },
    { t: '탄산은 잠깐 쉬어요', items: ['탄산음료·맥주는 공기를 그대로 마시는 셈이에요', '따뜻한 보리차·생강차가 속을 데워 줘요', '식사 중 물은 조금씩 나눠 마셔요'], foot: '빨대보다 컵으로 천천히 마셔 보세요' },
    { t: '사과는 반 개부터', items: ['사과·배·수박은 과당과 섬유질이 가스를 만들어요', '껍질을 벗기거나 익혀 먹으면 덜해요', '한 번에 한 개보다 반 개부터 시작해요'], foot: '과일은 오전에 먹으면 부담이 적어요' },
    { t: '유제품은 몸에 맞게', items: ['우유·치즈·아이스크림은 유당이 가스를 만들어요', '요거트·발효유는 상대적으로 편해요', '마시고 나서 배가 부글거리면 양을 줄여 보세요'], foot: '유당이 불편하면 두유도 좋은 선택이에요' },
    { t: '천천히 꼭꼭 씹기', items: ['급하게 먹으면 공기를 같이 삼켜요', '한 입에 20번 이상 씹어 보세요', '식사는 20분 이상, 말은 조금 줄이고'], foot: '숟가락을 내려놓는 것만으로도 느려져요' },
    { t: '콩은 불려서', items: ['콩·팥·렌틸콩은 올리고당이 많아요', '최소 6시간 불린 뒤 익히면 덜해요', '첫날은 두 숟가락부터 시작해요'], foot: '콩물·두유도 양을 조금씩 나눠 보세요' },
    { t: '양배추는 살짝 익혀서', items: ['십자화과 채소는 생으로 먹으면 가스가 늘어요', '살짝 데치거나 볶으면 부드러워져요', '생채소 샐러드는 반찬으로 조금만'], foot: '씹는 양을 줄이면 부담도 줄어요' },
    { t: '단 음료는 물로', items: ['탄산·과즙음료는 가스와 당을 함께 가져와요', '물·보리차·결명자차가 좋아요', '하루 물 6~8잔을 나눠 마셔요'], foot: '차가운 물보다 미지근한 물이 편해요' },
    { t: '기름진 음식 다음 날', items: ['튀김·치킨·삼겹살은 소화가 오래 걸려요', '다음 날은 죽·흰밥 위주로 가볍게', '걷기 20분이 속을 도와줘요'], foot: '야식은 특히 부담이 커요' },
    { t: '변비가 있으면 가스도 늘어요', items: ['섬유질과 물을 함께 늘려 주세요', '아침 공복에 미지근한 물 한 잔', '화장실은 참지 말고 규칙적으로'], foot: '배를 시계 방향으로 마사지해도 좋아요' },
    { t: '스트레스도 배에 와요', items: ['긴장하면 장 운동이 흐트러져요', '식사 전 세 번 깊게 숨 쉬어요', '먹으면서 걱정 이야기는 잠깐 미뤄요'], foot: '천천히 숨 쉬는 것만으로도 달라져요' },
    { t: '껌은 조금만', items: ['껌을 오래 씹으면 공기를 삼켜요', '사탕·탄산과 겹치면 가스가 늘어요', '입이 심심하면 따뜻한 차 한 잔'], foot: '식후 껌은 5분 정도면 충분해요' },
    { t: '바나나는 익은 걸로', items: ['덜 익은 바나나는 가스가 늘어요', '껍질에 갈색 점이 생긴 게 편해요', '한 번에 두 개보다 하나'], foot: '아침 공복엔 조금만 드세요' },
    { t: '매운 음식은 다음 날', items: ['매운 음식은 장을 자극해 가스가 늘어요', '먹은 다음 날은 부드러운 음식으로', '물을 자주 마셔 주세요'], foot: '매운맛 뒤엔 우유보다 두유가 편해요' },
    { t: '식후 10분 걷기', items: ['앉아 있으면 가스가 위에 머물러요', '식후 10분만 천천히 걸어 보세요', '허리를 펴고 배를 살짝 움직이며'], foot: '격한 운동보다 가벼운 산책이 좋아요' },
    { t: '미역·다시마는 부드럽게', items: ['해조류는 많이 먹으면 가스가 늘어요', '충분히 불리고 오래 끓여 주세요', '국물 위주로 조금씩'], foot: '미역국은 아침에 먹으면 든든해요' },
    { t: '우유가 부글부글하면', items: ['우유를 마시면 배가 부글거릴 수 있어요', '두유·귀리 음료로 바꿔 보세요', '치즈는 소량씩 나눠 먹어요'], foot: '몸이 편한 쪽을 기록해 두면 좋아요' },
    { t: '오늘의 속 체크', items: ['편안했다면 그 음식을 기억해 두세요', '뿡뿡했다면 양과 시간을 적어 보세요', '3일만 모아도 내 패턴이 보여요'], foot: '기록이 쌓이면 나만의 공식이 돼요' },
  ];

  /* ───────── 작은 도구들 ───────── */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function localKey(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }
  function koreanDate(d) {
    const x = d || new Date();
    return `${x.getMonth() + 1}월 ${x.getDate()}일 ${WEEK[x.getDay()]}요일`;
  }
  function fullKoreanDate(d) {
    const x = d || new Date();
    return `${x.getFullYear()}년 ${x.getMonth() + 1}월 ${x.getDate()}일 ${WEEK[x.getDay()]}요일`;
  }
  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = Math.floor((now - start) / 86400000);
    return Math.floor(diff + now.getFullYear() * 366);
  }
  function timeLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const today = localKey(d) === localKey();
    const h = d.getHours();
    const ampm = h < 12 ? '오전' : '오후';
    const hh = h % 12 === 0 ? 12 : h % 12;
    const t = `${ampm} ${hh}:${pad2(d.getMinutes())}`;
    return today ? `오늘 ${t}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${t}`;
  }
  function normFood(q) {
    return String(q || '').replace(/\s+/g, '').trim();
  }
  function toneOf(t) {
    return TONES.includes(t) ? t : 'lilac';
  }
  function uid() {
    return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }
  // 받침에 따라 조사를 골라요 (양파를 / 마늘을, 뿡으로 / 편안으로)
  function josa(word, withFinal, withoutFinal) {
    const str = String(word || '');
    if (!str) return withoutFinal;
    const code = str.charCodeAt(str.length - 1);
    if (code < 0xAC00 || code > 0xD7A3) return withoutFinal;
    return (code - 0xAC00) % 28 === 0 ? withoutFinal : withFinal;
  }

  const foodByName = (name) => FOODS.find((f) => f.n === name) || null;

  // 1) 이름 그대로 → 2) 비슷한 말 그대로 → 3) 가장 긴 부분 키워드
  //    '어묵탕'은 어묵, '사과주스'는 사과로 (긴 키워드 우선, 같으면 앞에서 시작하는 쪽)
  function findFood(query) {
    const q = normFood(query);
    if (!q) return null;
    const lowered = q.toLowerCase();

    for (const f of FOODS) {
      if (f.n.toLowerCase() === lowered) return f;
    }

    if (ALIASES[q]) {
      const hit = foodByName(ALIASES[q]);
      if (hit) return hit;
    }

    let best = null;
    const consider = (word, food) => {
      const key = word.toLowerCase();
      let pos = lowered.indexOf(key);
      if (pos < 0) {
        if (!key.includes(lowered)) return;
        pos = 0;
      }
      const score = key.length * 1000 - pos;
      if (!best || score > best.score) best = { food, score };
    };
    for (const f of FOODS) consider(f.n, f);
    for (const k of Object.keys(ALIASES)) {
      const f = foodByName(ALIASES[k]);
      if (f) consider(k, f);
    }
    return best ? best.food : null;
  }

  // 기록에 붙일 그림 — 직접 고른 이모지가 있으면 그대로 두고, 사전 그림이 있으면 그림
  function picForRecord(rec) {
    if (!rec || rec.noIcon) return '';
    if (rec.pic) return rec.pic;
    const f = findFood(rec.food);
    if (!f || !f.p) return '';
    if (!rec.emoji || rec.emoji === f.e) return f.p;
    return '';
  }

  const familyOf = (id) => FAMILY.find((f) => f.id === id) || FAMILY[0];
  const stageOf = (id) => STAGE_MAP[id] || STAGE_MAP.single;

  /* ───────── 상태 ───────── */
  const state = { records: [] };
  let who = 'mom';
  let currentView = 'log';
  let pickedStage = 'single';
  let editingId = null;
  let draftStage = 'single';
  let draftEmoji = '';
  let draftPic = '';
  let draftNoIcon = false;
  let draftTone = '';
  let noIconNext = false;
  let deleteArmed = false;
  let deleteTimer = null;
  let toastTimer = null;

  const sound = { ctx: null, on: true, log: [] };
  const share = { url: DEFAULT_FIREBASE_URL, room: '', linked: false };
  const net = { mode: 'local', es: null, pollTimer: null, fails: 0, synced: false, dirty: new Set(), flushing: false };

  /* ───────── 저장 ───────── */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.records)) {
          state.records = data.records.filter((r) => r && typeof r.food === 'string');
        }
      }
    } catch (e) { /* 무시 */ }

    try {
      const w = localStorage.getItem(WHO_KEY);
      if (FAMILY.some((f) => f.id === w)) who = w;
    } catch (e) { /* 무시 */ }

    try {
      const s = localStorage.getItem(SOUND_KEY);
      if (s === 'off') sound.on = false;
    } catch (e) { /* 무시 */ }

    try {
      const raw = localStorage.getItem(SHARE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.url === 'string') share.url = normDb(d.url);
        if (typeof d.room === 'string') share.room = normRoom(d.room);
      }
    } catch (e) { /* 무시 */ }
    if (!share.url) share.url = DEFAULT_FIREBASE_URL;

    try {
      const arr = JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]');
      if (Array.isArray(arr)) arr.forEach((id) => { if (typeof id === 'string') net.dirty.add(id); });
    } catch (e) { /* 무시 */ }

    try {
      const linked = normRoom(new URLSearchParams(location.search).get('room') || '');
      if (roomValid(linked)) {
        share.room = linked;
        share.linked = true;
        persistShare();
      }
    } catch (e) { /* 무시 */ }
  }

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ records: state.records, savedAt: Date.now() })); } catch (e) { /* 무시 */ }
  }
  function persistWho() { try { localStorage.setItem(WHO_KEY, who); } catch (e) { /* 무시 */ } }
  function persistSound() { try { localStorage.setItem(SOUND_KEY, sound.on ? 'on' : 'off'); } catch (e) { /* 무시 */ } }
  function persistShare() { try { localStorage.setItem(SHARE_KEY, JSON.stringify({ url: share.url, room: share.room })); } catch (e) { /* 무시 */ } }
  function persistDirty() { try { localStorage.setItem(DIRTY_KEY, JSON.stringify(Array.from(net.dirty))); } catch (e) { /* 무시 */ } }

  function memberRecords(id) {
    return state.records.filter((r) => r.who === id && !r.deleted);
  }
  // 기간은 '마지막으로 손댄 때'(updatedAt) 기준 — 같은 음식을 다시 저장하면
  // 기존 칸에서 단계만 옮겨도 오늘 표에 그대로 보여요.
  function stampOf(rec) {
    const ms = Number(rec.updatedAt);
    if (ms) return ms;
    const at = Date.parse(rec.at);
    return Number.isFinite(at) ? at : Date.now();
  }
  function inRange(rec, how) {
    if (how === 'all') return true;
    const stamp = stampOf(rec);
    if (how === 'today') return localKey(new Date(stamp)) === localKey();
    if (how === 'week') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      return stamp >= start.getTime();
    }
    return true;
  }
  function rangeRecords(id, how) {
    return memberRecords(id).filter((r) => inRange(r, how));
  }

  /* ───────── 화면 공통 ───────── */
  function setView(view, opts) {
    currentView = view === 'board' ? 'board' : 'log';
    $('viewLog').hidden = currentView !== 'log';
    $('viewBoard').hidden = currentView !== 'board';
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.view === currentView));
    if (currentView === 'board') renderBoard();
    if (!(opts && opts.silent)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setWho(next, opts) {
    if (!FAMILY.some((f) => f.id === next)) return;
    who = next;
    persistWho();
    renderFamily();
    renderLog();
    renderBoard();
    renderTabCount();
    if (!(opts && opts.silent)) {
      const f = familyOf(who);
      showToast(`${f.emoji} ${f.name}의 기록으로 바꿨어요`);
    }
  }

  function renderFamily() {
    document.querySelectorAll('.fam').forEach((b) => {
      const on = b.dataset.who === who;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const f = familyOf(who);
    $('brandSub').textContent = `${f.name}의 장건강 노트`;
    $('helloTitle').textContent = `${f.name}, 오늘 뭐 드셨어요?`;
    const face = $('helloPhoto');
    if (face && face.getAttribute('src') !== f.photo) face.src = f.photo;
    if (face) face.alt = `${f.name} 사진`;
    $('boardTitle').textContent = `${f.name}의 뿡뿡 표`;
  }

  function renderToday() {
    $('todayLabel').textContent = koreanDate();
    $('boardDate').textContent = `오늘 · ${koreanDate()}`;
  }

  function renderTabCount() {
    const n = rangeRecords(who, 'today').length;
    const b = $('tabCount');
    b.textContent = String(n);
    b.hidden = n === 0;
  }

  /* ───────── 미리보기 ───────── */
  let lastPreviewKey = '';

  // 동그라미 안에 음식 그림(foods/*.webp)을 보여 줄지, 이모지를 보여 줄지
  function previewFace(opts) {
    const img = $('previewPic');
    const el = $('previewEmoji');
    if (opts.pic && img) {
      const src = picSrc(opts.pic);
      if (img.getAttribute('src') !== src) img.src = src;
      img.hidden = false;
      el.hidden = true;
      el.className = 'preview-emoji';
      return;
    }
    if (img) {
      img.hidden = true;
      img.removeAttribute('src');
    }
    el.hidden = false;
    el.className = `preview-emoji${opts.cls ? ` ${opts.cls}` : ''}`;
    el.textContent = opts.text;
  }

  function renderPreview() {
    const q = $('foodInput').value;
    const circle = $('previewCircle');
    const nameEl = $('previewName');
    const hintEl = $('previewHint');
    const trimmed = q.trim();

    if (!trimmed) {
      circle.dataset.tone = 'butter';
      if (lastPreviewKey !== 'empty') {
        previewFace({ text: '🍽️' });
        popCircle();
      }
      lastPreviewKey = 'empty';
      nameEl.textContent = '음식을 적으면 그림이 뿅!';
      hintEl.textContent = '양파, 사과, 마늘처럼 적어 보세요';
      hintEl.dataset.cat = '';
      return;
    }

    // 그림이 잘 맞지 않는 음식은 글자만 보여 줄 수 있어요
    if (noIconNext) {
      circle.dataset.tone = 'lilac';
      const key = `text:${trimmed}`;
      if (lastPreviewKey !== key) {
        previewFace({ text: trimmed.slice(0, 4), cls: 'asText' });
        popCircle();
      }
      lastPreviewKey = key;
      nameEl.innerHTML = `<em>${esc(trimmed)}</em>`;
      hintEl.textContent = '그림 없이 글자만 보여 줄게요';
      hintEl.dataset.cat = '';
      return;
    }

    const f = findFood(trimmed);
    if (f) {
      circle.dataset.tone = toneOf(f.t);
      const pic = f.p || '';
      const key = pic ? `pic:${pic}` : `e:${f.e}`;
      if (lastPreviewKey !== key) {
        if (pic) previewFace({ pic });
        else previewFace({ text: f.e });
        popCircle();
      }
      lastPreviewKey = key;
      nameEl.innerHTML = `<em>${esc(f.n)}</em>`;
      const hints = {
        gas: '가스가 좀 생길 수 있어요 · 조금씩 드세요',
        gentle: '속이 편한 음식이에요 🌿',
        neutral: '기록해 두고 내 반응을 살펴봐요',
      };
      hintEl.textContent = hints[f.c] || hints.neutral;
      hintEl.dataset.cat = f.c;
    } else {
      circle.dataset.tone = 'lilac';
      const key = `new:${trimmed}`;
      if (lastPreviewKey !== key) {
        previewFace({ text: trimmed.slice(0, 1), cls: 'badge' });
        popCircle();
      }
      lastPreviewKey = key;
      nameEl.textContent = trimmed;
      hintEl.textContent = '사전에 없는 음식이라 기본 그림으로 보여 줘요';
      hintEl.dataset.cat = '';
    }
  }

  function popCircle() {
    const c = $('previewCircle');
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
  }

  function renderQuick() {
    const row = $('quickRow');
    const seen = new Set();
    const items = [];
    memberRecords(who)
      .slice()
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .forEach((r) => {
        const key = normFood(r.food);
        if (seen.has(key) || items.length >= 7) return;
        seen.add(key);
        items.push({ food: r.food, emoji: r.emoji || '🍽️' });
      });
    const defaults = [
      { food: '양파', emoji: '🧅' }, { food: '사과', emoji: '🍎' }, { food: '마늘', emoji: '🧄' },
      { food: '고구마', emoji: '🍠' }, { food: '우유', emoji: '🥛' }, { food: '김치', emoji: '🥬' },
    ];
    for (const d of defaults) {
      if (items.length >= 7) break;
      if (!seen.has(normFood(d.food))) { seen.add(normFood(d.food)); items.push(d); }
    }
    row.innerHTML = items.map((it) => `<button type="button" class="quick" data-food="${esc(it.food)}"><span>${esc(it.emoji)}</span>${esc(it.food)}</button>`).join('');
  }

  function renderTip() {
    const tip = TIPS[dayIndex() % TIPS.length];
    $('tipTitle').textContent = tip.t;
    $('tipList').innerHTML = tip.items
      .map((text, i) => `<li><i>${['①', '②', '③'][i] || i + 1}</i><span>${esc(text)}</span></li>`)
      .join('');
    const n = (dayIndex() % TIPS.length) + 1;
    $('tipFoot').textContent = `${tip.foot} · 오늘은 ${n}번째 이야기 (${TIPS.length}일마다 새로워요)`;
  }

  function renderLog() {
    renderToday();
    renderPreview();
    renderQuick();
    renderTip();
    renderTabCount();
  }

  /* ───────── 보드 ───────── */
  function chipHTML(rec) {
    const st = stageOf(rec.stage);
    const tone = toneOf(rec.tone);
    const emoji = rec.emoji || '🍽️';
    const textOnly = !!rec.noIcon;
    const pic = picForRecord(rec);
    const badge = !rec.emoji && !textOnly && !pic;
    let fig = '';
    if (!textOnly) {
      if (pic) {
        fig = `<span class="chip-fig has-pic" data-tone="${tone}"><img class="food-pic" src="${picSrc(pic)}" alt="" loading="lazy" decoding="async"></span>`;
      } else {
        fig = `<span class="chip-fig${badge ? ' badge' : ''}" data-tone="${tone}">${badge ? esc(rec.food.slice(0, 1)) : esc(emoji)}</span>`;
      }
    }
    return `<button type="button" class="chip${textOnly ? ' text-only' : ''}" data-id="${esc(rec.id)}" aria-label="${esc(rec.food)} ${esc(st.label)}${rec.note ? ' 메모 있음' : ''}">
      ${fig}
      <span class="chip-name">${esc(rec.food)}</span>
      ${rec.note ? '<span class="chip-memo" aria-hidden="true">💬</span>' : ''}
    </button>`;
  }

  function renderBoard() {
    renderToday();
    const board = $('board');
    // 누적 기록만 쌓이는 표 — 기간 필터 없이 항상 전체를 보여 줘요
    const recs = memberRecords(who).slice().sort((a, b) => stampOf(b) - stampOf(a));
    board.innerHTML = STAGES.map((st) => {
      const list = recs.filter((r) => r.stage === st.id).sort((a, b) => new Date(b.at) - new Date(a.at));
      const body = list.length
        ? list.map(chipHTML).join('')
        : `<div class="col-empty"><span>${st.id === 'calm' ? '🌿' : st.id === 'triple' ? '💨' : '☁️'}</span>${st.id === 'triple' ? '아직 조용해요' : st.id === 'calm' ? '편안한 하루' : '여기는 비어 있어요'}</div>`;
      return `<div class="col" data-stage="${st.id}">
        <div class="col-head"><span>${st.label}</span><span class="n">${list.length}</span></div>
        <div class="col-body">${body}</div>
      </div>`;
    }).join('');
  }

  /* ───────── 저장 · 수정 ───────── */
  function addRecord(data) {
    const now = new Date();
    const rec = {
      id: uid(),
      who,
      food: String(data.food || '').slice(0, 20),
      emoji: data.emoji || '',
      pic: data.pic || '',
      noIcon: !!data.noIcon,
      tone: toneOf(data.tone),
      cat: data.cat || '',
      stage: stageOf(data.stage).id,
      note: String(data.note || '').slice(0, 120),
      at: now.toISOString(),
      updatedAt: Date.now(),
    };
    state.records.push(rec);
    commit(rec);
    return rec;
  }

  function commit(rec) {
    persist();
    renderBoard();
    renderQuick();
    renderTabCount();
    pushRecord(rec);
  }

  function saveFromInput(stageId) {
    const input = $('foodInput');
    const food = input.value.trim();
    if (!food) {
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      input.focus();
      showToast('먹은 음식을 먼저 적어 주세요 ✏️');
      return null;
    }
    const f = findFood(food);
    const key = normFood(food);
    const st = stageOf(stageId);
    const noIcon = noIconNext;
    const existing = state.records.find((r) => !r.deleted && r.who === who && normFood(r.food) === key);

    let rec;
    let moved = false;
    if (existing) {
      // 같은 사람 안에서는 같은 음식을 한 칸에만! 새 칩 대신 단계만 옮기고 메모는 그대로 둬요.
      moved = existing.stage !== st.id;
      existing.stage = st.id;
      if (noIcon) {
        existing.noIcon = true;
        existing.emoji = '';
        existing.pic = '';
        existing.tone = 'lilac';
      } else if (f && !existing.emoji && !existing.noIcon) {
        existing.emoji = f.e;
        existing.pic = f.p || '';
        existing.tone = toneOf(f.t);
        existing.cat = f.c;
      }
      existing.updatedAt = Date.now();
      rec = existing;
      commit(rec);
    } else {
      rec = addRecord({
        food,
        stage: stageId,
        emoji: noIcon ? '' : (f ? f.e : ''),
        pic: noIcon || !f ? '' : (f.p || ''),
        tone: f ? f.t : 'lilac',
        cat: f ? f.c : '',
        noIcon,
      });
    }

    noIconNext = false;
    renderNoIconToggle();
    input.value = '';
    lastPreviewKey = '';
    renderPreview();
    pickedStage = st.id;
    markPicked();
    playStage(stageId, true);
    setView('board', { silent: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (existing) {
      showToast(moved
        ? `‘${rec.food}’${josa(rec.food, '을', '를')} ‘${st.label}’ 칸으로 옮겼어요`
        : `‘${rec.food}’${josa(rec.food, '을', '를')} ‘${st.label}’ 칸에 이미 있어요 · 최신 상태로 반영했어요`);
    } else {
      showToast(`‘${rec.food}’${josa(rec.food, '을', '를')} ‘${st.label}’ 칸에 담았어요!`);
    }
    setTimeout(() => {
      const chip = document.querySelector(`.chip[data-id="${rec.id}"]`);
      if (chip) {
        chip.classList.add('flash');
        chip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 80);
    return rec;
  }

  function markPicked() {
    document.querySelectorAll('.stage').forEach((b) => b.classList.toggle('picked', b.dataset.stage === pickedStage));
  }

  /* ───────── 방귀 소리 (Web Audio) ───────── */
  function ensureCtx() {
    if (!sound.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { sound.ctx = new AC(); } catch (e) { return null; }
    }
    if (sound.ctx.state === 'suspended') {
      try { sound.ctx.resume().catch(() => {}); } catch (e) { /* 무시 */ }
    }
    return sound.ctx;
  }

  function noisePuff(ctx, dest, at, dur, level) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const env = Math.pow(1 - i / len, 1.8);
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(bp).connect(g).connect(dest);
    src.start(at);
  }

  function fart(ctx, count, opt) {
    const t0 = ctx.currentTime + 0.015;
    const master = ctx.createGain();
    master.gain.value = opt.level == null ? 0.5 : opt.level;
    master.connect(ctx.destination);

    for (let i = 0; i < count; i += 1) {
      const t = t0 + i * (opt.dur + 0.085);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(opt.cut || 640, t);
      lp.Q.value = 6;
      const g = ctx.createGain();
      const startF = opt.base + i * 7;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(38, startF * 0.52), t + opt.dur);

      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = opt.wobble || 23;
      const lg = ctx.createGain();
      lg.gain.value = opt.depth || 24;
      lfo.connect(lg).connect(osc.frequency);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.55, t + opt.dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);

      osc.connect(lp).connect(g).connect(master);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + opt.dur + 0.03);
      lfo.stop(t + opt.dur + 0.03);
      noisePuff(ctx, master, t, Math.min(0.22, opt.dur), 0.12);
    }
  }

  function sparkle(ctx) {
    const t0 = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    [880, 1174.7, 1568, 2093].forEach((freq, i) => {
      const t = t0 + i * 0.075;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    noisePuff(ctx, master, t0, 0.16, 0.05);
  }

  function playStage(stageId, force) {
    const st = stageOf(stageId);
    sound.log.push({ stage: stageId, muted: !sound.on, at: Date.now() });
    if (sound.log.length > 200) sound.log.shift();
    if (!sound.on && !force) return;
    if (!sound.on) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      if (stageId === 'triple') fart(ctx, 3, { base: 92, dur: 0.26, level: 0.52, cut: 560, wobble: 19, depth: 26 });
      else if (stageId === 'double') fart(ctx, 2, { base: 118, dur: 0.2, level: 0.44, cut: 700, wobble: 26, depth: 22 });
      else if (stageId === 'single') fart(ctx, 1, { base: 178, dur: 0.16, level: 0.34, cut: 980, wobble: 32, depth: 18 });
      else sparkle(ctx);
    } catch (e) {
      console.warn('소리를 만들지 못했어요', e);
    }
  }

  /* ───────── 토스트 ───────── */
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 220);
    }, 2100);
  }

  function hideToast() {
    const t = $('toast');
    t.classList.remove('show');
    t.hidden = true;
    clearTimeout(toastTimer);
  }

  /* ───────── 상세 시트 ───────── */
  /* 모달·추가창 화면 고정 (2026-11-28)
     열 때 스크롤 위치를 저장하고 body를 fixed로 잠가 배경이 흔들리지 않게 한다.
     여러 창이 겹쳐 열려도 마지막 창이 닫힐 때만 원래 위치로 돌아간다. */
  let lockedScrollY = null;
  const MODAL_IDS = ['detailWrap', 'shareWrap', 'linkWrap'];

  function lockModals() {
    const anyOpen = MODAL_IDS.some((id) => {
      const n = document.getElementById(id);
      return n && !n.hidden;
    });
    const isLocked = document.body.classList.contains('modal-open');

    if (anyOpen && !isLocked) {
      lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.classList.add('modal-open');
    } else if (!anyOpen && isLocked) {
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      const backY = lockedScrollY || 0;
      lockedScrollY = null;
      window.scrollTo(0, backY);
    }
  }

  function openDetail(id) {
    hideToast();
    const rec = state.records.find((r) => r.id === id && !r.deleted);
    if (!rec) return;
    editingId = id;
    draftStage = rec.stage;
    draftEmoji = rec.emoji || '';
    draftPic = rec.pic || picForRecord(rec) || '';
    draftNoIcon = !!rec.noIcon;
    draftTone = toneOf(rec.tone);
    const st = stageOf(rec.stage);
    const tone = toneOf(rec.tone);

    $('detailTitle').textContent = rec.food;
    $('detailWhen').textContent = `${timeLabel(new Date(stampOf(rec)).toISOString())} · ${st.label}`;
    $('detailCircle').dataset.tone = tone;
    paintDetailFace(rec);
    $('memoInput').value = rec.note || '';
    renderDetailStages();
    renderEmojiGrid();
    $('emojiMore').open = false;
    armDelete(false);
    $('detailWrap').hidden = false;
    lockModals();
  }

  // 상세 시트의 동그란 그림 — '글만 보기'면 음식 이름 글자만
  function paintDetailFace(rec) {
    const circle = $('detailCircle');
    const el = $('detailEmoji');
    const img = $('detailPic');
    if (draftNoIcon) {
      if (img) img.hidden = true;
      el.hidden = false;
      circle.classList.add('asText');
      el.textContent = rec ? rec.food.slice(0, 4) : '글자';
      return;
    }
    circle.classList.remove('asText');
    if (draftPic && img) {
      const src = picSrc(draftPic);
      if (img.getAttribute('src') !== src) img.src = src;
      img.hidden = false;
      el.hidden = true;
      return;
    }
    if (img) img.hidden = true;
    el.hidden = false;
    el.textContent = draftEmoji || (rec ? rec.food.slice(0, 1) : '🍽️');
  }

  function closeDetail() {
    $('detailWrap').hidden = true;
    lockModals();
    editingId = null;
    armDelete(false);
  }

  function renderDetailStages() {
    document.querySelectorAll('#detailStages button').forEach((b) => {
      b.classList.toggle('on', b.dataset.stage === draftStage);
    });
    const st = stageOf(draftStage);
    const when = $('detailWhen');
    if (when) {
      const base = when.textContent.split(' · ')[0];
      when.textContent = `${base} · ${st.label}`;
    }
  }

  function renderEmojiGrid() {
    const textBtn = `<button type="button" class="emoji-none${draftNoIcon ? ' on' : ''}" data-emoji="none" aria-pressed="${draftNoIcon ? 'true' : 'false'}">글만 보기 (그림 없이)</button>`;
    const picHead = '<p class="pic-head">한국 음식 그림</p>';
    const picBtns = PIC_ORDER.map((slug) => {
      const on = !draftNoIcon && draftPic === slug;
      return `<button type="button" class="pic-btn${on ? ' on' : ''}" data-pic="${slug}" title="${esc(PIC_NAMES[slug])}" aria-label="${esc(PIC_NAMES[slug])} 그림" aria-pressed="${on ? 'true' : 'false'}"><img class="food-pic" src="${picSrc(slug)}" alt="" loading="lazy" decoding="async"></button>`;
    }).join('');
    const emojiHead = '<p class="pic-head">이모지</p>';
    $('emojiGrid').innerHTML = textBtn + picHead + picBtns + emojiHead + EMOJI_PALETTE
      .map((e) => `<button type="button" data-emoji="${e}" class="${!draftNoIcon && !draftPic && draftEmoji === e ? 'on' : ''}" aria-label="${e}">${e}</button>`)
      .join('');
  }

  function armDelete(on) {
    const btn = $('detailDelete');
    deleteArmed = !!on;
    btn.textContent = deleteArmed ? '정말 삭제할까요?' : '삭제';
    btn.classList.toggle('danger', true);
    clearTimeout(deleteTimer);
    if (deleteArmed) {
      deleteTimer = setTimeout(() => armDelete(false), 2600);
    }
  }

  function saveDetail() {
    const rec = state.records.find((r) => r.id === editingId && !r.deleted);
    if (!rec) return;
    rec.stage = draftStage;
    rec.note = $('memoInput').value.trim().slice(0, 120);
    if (draftNoIcon) {
      rec.noIcon = true;
      rec.emoji = '';
      rec.pic = '';
    } else if (draftPic) {
      rec.noIcon = false;
      rec.emoji = '';
      rec.pic = draftPic;
      const f = FOODS.find((x) => x.p === draftPic);
      rec.tone = f ? toneOf(f.t) : draftTone;
    } else if (draftEmoji) {
      rec.noIcon = false;
      rec.pic = '';
      rec.emoji = draftEmoji;
      const f = FOODS.find((x) => x.e === draftEmoji);
      rec.tone = f ? toneOf(f.t) : draftTone;
    } else {
      rec.noIcon = false;
      rec.emoji = '';
      rec.pic = '';
      rec.tone = draftTone;
    }
    rec.updatedAt = Date.now();
    commit(rec);
    closeDetail();
    showToast(`저장했어요 · ${stageOf(rec.stage).label} 칸`);
  }

  function deleteRecord() {
    const rec = state.records.find((r) => r.id === editingId && !r.deleted);
    if (!rec) return;
    rec.deleted = true;
    rec.updatedAt = Date.now();
    commit(rec);
    closeDetail();
    renderBoard();
    showToast('기록을 지웠어요');
  }

  /* ───────── 뿡밍아웃 카드 ───────── */
  let shareBlob = null;
  let shareUrlCache = '';

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function makeComment(recs) {
    const c = { triple: 0, double: 0, single: 0, calm: 0 };
    recs.forEach((r) => { if (c[r.stage] != null) c[r.stage] += 1; });
    const total = recs.length;
    if (!total) return '오늘은 아직 기록이 없어요 · 내일 한 번 남겨 볼까요?';
    const parts = [];
    if (c.calm) parts.push(`편안 ${c.calm}`);
    if (c.single) parts.push(`뿡 ${c.single}`);
    if (c.double) parts.push(`뿡뿡 ${c.double}`);
    if (c.triple) parts.push(`뿡뿡뿡 ${c.triple}`);
    let tail = ' · 조금씩 살펴보고 있어요';
    if (c.triple >= 2 || c.double >= 3) tail = ' · 따뜻한 물 한 잔이 도와줄 거예요';
    else if (c.calm > 0 && c.triple === 0 && c.double === 0) tail = ' · 오늘 속이 참 편안했네요 🌿';
    return `오늘 ${total}개 기록 · ${parts.join(', ')}${tail}`;
  }

  function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
    return yy;
  }

  /* ───────── 가족 사진 · 뿡뿡이 캐릭터 그림 ───────── */
  const art = { photos: {}, character: null, foods: {}, foodJobs: {} };
  let artPromise = null;

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im.naturalWidth ? im : null);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  function ensureArt() {
    if (!artPromise) {
      artPromise = Promise.all([
        ...FAMILY.map((f) => loadImage(f.photo).then((im) => { art.photos[f.id] = im; })),
        loadImage(CHARACTER_SRC).then((im) => { art.character = im; }),
      ]).then(() => true);
    }
    return artPromise;
  }

  // 음식 그림은 카드에 쓸 것만 미리 불러 두고, 다 그려질 때까지(decode) 기다려요
  function loadFoodPic(slug) {
    if (!slug) return Promise.resolve(null);
    if (art.foods[slug]) return Promise.resolve(art.foods[slug]);
    if (!art.foodJobs[slug]) {
      art.foodJobs[slug] = loadImage(picSrc(slug)).then((im) => {
        if (!im) return null;
        const decoded = im.decode ? im.decode().catch(() => {}) : Promise.resolve();
        return decoded.then(() => { art.foods[slug] = im; return im; });
      });
    }
    return art.foodJobs[slug];
  }

  function ensureFoodPics(recs) {
    const jobs = (recs || []).map((r) => loadFoodPic(picForRecord(r)));
    return Promise.all(jobs).then(() => true);
  }

  // 둥근 사진을 꾹 찍은 스티커처럼 카드에 붙여요
  function drawPhotoCircle(ctx, img, cx, cy, r) {
    if (!img) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(243, 223, 204, .95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function buildShareCard() {
    const W = 1080;
    const H = 1350;    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const x = cv.getContext('2d');
    const f = familyOf(who);
    const today = rangeRecords(who, 'today');
    if (window.__bbung) {
      window.__bbung.cardInfo = {
        who,
        total: today.length,
        textOnly: today.filter((r) => r.noIcon).length,
        icons: today.filter((r) => !r.noIcon).length,
        foodPics: today.filter((r) => {
          const slug = picForRecord(r);
          return !!(slug && art.foods[slug]);
        }).length,
      };
    }
    const EMOJI_FONT = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
    const KR = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#FFF9F1');
    bg.addColorStop(0.55, '#FFF4E8');
    bg.addColorStop(1, '#FDF0F5');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    x.globalAlpha = 0.55;
    x.fillStyle = '#FFE0CB';
    x.beginPath(); x.arc(96, 110, 150, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#DDF3E7';
    x.beginPath(); x.arc(1000, 260, 170, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#EDE4FC';
    x.beginPath(); x.arc(120, 1240, 190, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    // 왼쪽 위에 가족 사진 스티커
    drawPhotoCircle(x, art.photos[who], 112, 196, 58);

    x.textAlign = 'center';
    x.fillStyle = '#B08A74';
    x.font = `700 30px ${KR}`;
    x.fillText('💨 뿡뿡이 기록 · 가족 장건강 노트', W / 2, 104);

    const title = `${f.name}의 뿡뿡이 기록`;
    x.fillStyle = '#4E3B31';
    x.font = `800 64px ${KR}`;
    const titleW = x.measureText(title).width;
    const titleX = W / 2 - 22;
    x.fillText(title, titleX, 196);
    x.font = `400 50px ${EMOJI_FONT}`;
    x.fillText('💨', titleX + titleW / 2 + 100, 192);

    x.fillStyle = '#F38AA8';
    x.font = `800 36px ${KR}`;
    x.fillText('내 건강 뿡밍아웃!', W / 2, 254);

    x.fillStyle = '#93796B';
    x.font = `500 28px ${KR}`;
    x.fillText(fullKoreanDate(), W / 2, 308);

    const bx = 62;
    const by = 352;
    const bw = W - 124;
    const maxCount = STAGES.reduce((m, st) => Math.max(m, today.filter((r) => r.stage === st.id).length), 0);
    const rows = Math.max(1, Math.min(4, maxCount));
    const bh = 96 + rows * 124 + 22;
    roundRect(x, bx, by, bw, bh, 44);
    x.fillStyle = 'rgba(255, 253, 249, 0.92)';
    x.fill();
    x.strokeStyle = '#F3E1CF';
    x.lineWidth = 3;
    x.stroke();

    const gap = 12;
    const colW = (bw - 48 - gap * 3) / 4;
    STAGES.forEach((st, i) => {
      const cx = bx + 24 + i * (colW + gap);
      const list = today.filter((r) => r.stage === st.id).sort((a, b) => new Date(b.at) - new Date(a.at));

      roundRect(x, cx, by + 26, colW, 62, 31);
      x.fillStyle = st.bg;
      x.fill();
      x.fillStyle = st.ink;
      x.font = `800 27px ${KR}`;
      x.textAlign = 'center';
      x.fillText(st.label, cx + colW / 2, by + 67);

      const shown = list.slice(0, 4);
      shown.forEach((r, j) => {
        const cy = by + 108 + j * 124;
        roundRect(x, cx + 6, cy, colW - 12, 110, 24);
        x.fillStyle = '#FFFDFA';
        x.fill();
        x.strokeStyle = '#F3E5D6';
        x.lineWidth = 2;
        x.stroke();

        if (r.noIcon) {
          // 그림 없이 글자만 보여 주는 음식
          const full = r.food.length > 7 ? `${r.food.slice(0, 7)}…` : r.food;
          x.fillStyle = '#5C473B';
          x.font = `800 27px ${KR}`;
          x.fillText(full, cx + colW / 2, cy + 56);
          x.fillStyle = '#BEAE9F';
          x.font = `600 18px ${KR}`;
          x.fillText('글자만', cx + colW / 2, cy + 86);
          return;
        }

        const slug = picForRecord(r);
        const pimg = slug ? art.foods[slug] : null;
        if (pimg) {
          // 음식 그림은 미리 불러 둔(Image().decode까지 끝난) 그림을 그대로 그려요
          x.drawImage(pimg, cx + colW / 2 - 31, cy + 41 - 31, 62, 62);
        } else {
          x.beginPath();
          x.arc(cx + colW / 2, cy + 41, 30, 0, Math.PI * 2);
          x.fillStyle = r.tone === 'mint' ? '#D6F0E3' : r.tone === 'peach' ? '#FFD9C2' : r.tone === 'rose' ? '#FFDCE7' : r.tone === 'sky' ? '#DCEFFB' : r.tone === 'butter' ? '#FFEFC6' : '#E7DEFB';
          x.fill();

          x.fillStyle = '#4E3B31';
          x.font = `400 38px ${EMOJI_FONT}`;
          x.fillText(r.emoji || r.food.slice(0, 1), cx + colW / 2, cy + 54);
        }

        x.fillStyle = '#5C473B';
        x.font = `700 22px ${KR}`;
        const name = r.food.length > 5 ? `${r.food.slice(0, 4)}…` : r.food;
        x.fillText(name, cx + colW / 2, cy + 94);
      });

      if (list.length > 4) {
        x.fillStyle = '#A08C7E';
        x.font = `700 20px ${KR}`;
        x.fillText(`+${list.length - 4}개 더`, cx + colW / 2, by + 108 + 4 * 124 + 16);
      }
      if (!list.length) {
        x.fillStyle = '#C9B7A8';
        x.font = `400 34px ${EMOJI_FONT}`;
        x.fillText('☁️', cx + colW / 2, by + 160);
        x.fillStyle = '#C4B2A4';
        x.font = `600 20px ${KR}`;
        x.fillText('비어 있어요', cx + colW / 2, by + 205);
      }
    });

    x.textAlign = 'center';
    x.fillStyle = '#6E584C';
    x.font = `700 30px ${KR}`;
    const commentEnd = wrapText(x, makeComment(today), W / 2, by + bh + 62, W - 200, 42);

    const tip = TIPS[dayIndex() % TIPS.length];
    const tipY = Math.min(commentEnd + 46, H - 250);
    roundRect(x, 96, tipY, W - 192, 128, 32);
    x.fillStyle = '#F1FAF5';
    x.fill();
    x.strokeStyle = '#D8EEE2';
    x.lineWidth = 2;
    x.stroke();
    x.textAlign = 'left';
    x.fillStyle = '#4E9179';
    x.font = `800 24px ${KR}`;
    x.fillText('💗 오늘의 건강 일기 TIP', 130, tipY + 44);
    x.fillStyle = '#5F7A6D';
    x.font = `600 25px ${KR}`;
    x.fillText(`${tip.t} · ${tip.items[0]}`, 130, tipY + 86);
    x.textAlign = 'center';

    const tipEnd = tipY + 128;
    if (tipEnd + 150 < H - 140) {
      const my = (tipEnd + H - 140) / 2;
      const cs = 210;
      if (art.character) {
        x.drawImage(art.character, W / 2 - cs / 2, my - cs / 2 - 12, cs, cs);
      } else {
        x.fillStyle = '#FFFDF8';
        x.beginPath(); x.arc(W / 2, my, 58, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#FFE9C9';
        x.beginPath(); x.arc(W / 2, my, 44, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#5B463A';
        x.beginPath(); x.arc(W / 2 - 15, my - 4, 5, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(W / 2 + 15, my - 4, 5, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#7A5B4A';
        x.lineWidth = 3;
        x.beginPath(); x.arc(W / 2, my + 14, 8, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      }
      x.fillStyle = '#A08C7E';
      x.font = `600 24px ${KR}`;
      x.textAlign = 'center';
      x.fillText('매일 기록하면 내 장 패턴이 보여요', W / 2, my + 118);
    }

    x.fillStyle = '#B8A395';
    x.font = `500 24px ${KR}`;
    x.fillText('오늘도 속 편한 하루 되세요 🌿', W / 2, H - 92);
    x.fillStyle = '#CBB9AA';
    x.font = `600 20px ${KR}`;
    x.fillText('bswjys.github.io/bbung-note', W / 2, H - 52);

    return cv;
  }

  async function openShare() {
    hideToast();
    $('shareWrap').hidden = false;
    lockModals();
    $('shareLoading').hidden = false;
    const img = $('shareImg');
    img.removeAttribute('src');
    const f = familyOf(who);
    const n = rangeRecords(who, 'today').length;
    $('shareSub').textContent = n
      ? `${f.name}의 오늘 기록 ${n}개를 귀여운 카드로 만들었어요`
      : `${f.name}의 오늘 기록이 아직 없어요 · 그래도 카드는 만들어 볼게요`;

    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    await ensureArt();
    await ensureFoodPics(rangeRecords(who, 'today'));
    let canvas;
    try {
      canvas = buildShareCard();
    } catch (e) {
      console.warn('카드를 만들지 못했어요', e);
      $('shareLoading').textContent = '카드를 만들지 못했어요';
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    shareUrlCache = dataUrl;
    img.onload = () => { $('shareLoading').hidden = true; };
    img.src = dataUrl;
    canvas.toBlob((blob) => { shareBlob = blob; }, 'image/png');
  }

  function closeShare() {
    $('shareWrap').hidden = true;
    lockModals();
  }

  function fileName() {
    return `bbung-${who}-${localKey()}.png`;
  }

  function downloadCard() {
    const url = shareUrlCache || $('shareImg').src;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    showToast('이미지를 내려받았어요 · 사진 앱에 없다면 카드를 꾹 눌러 저장해 주세요');
  }

  function pngFile(blob) {
    return new File([blob], fileName(), { type: 'image/png' });
  }

  async function cardBlob() {
    if (shareBlob) return shareBlob;
    if (!shareUrlCache) return null;
    try {
      return await (await fetch(shareUrlCache)).blob();
    } catch (e) {
      return null;
    }
  }

  // 아이폰은 <a download>로 사진함에 저장되지 않아요.
  // 공유 시트를 열어 '이미지 저장'을 누르게 하고, 데스크톱에서만 내려받기로 대신해요.
  async function saveCard() {
    const blob = await cardBlob();
    if (blob && navigator.share && navigator.canShare) {
      const file = pngFile(blob);
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '내 건강 뿡밍아웃' });
          showToast("공유 창에서 '이미지 저장'을 누르거나 위 카드를 꾹 눌러 저장하세요");
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
    }
    downloadCard();
  }

  async function sendCard() {
    const blob = await cardBlob();
    if (blob && navigator.share && navigator.canShare) {
      const file = pngFile(blob);
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '내 건강 뿡밍아웃',
            text: `${familyOf(who).name}의 뿡뿡이 기록 💨`,
          });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
    }
    downloadCard();
  }

  /* ═════════ 가족 실시간 공유 (Firebase RTDB REST + SSE) ═════════ */
  function normDb(u) {
    let s = String(u || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    return s.replace(/\/+$/, '');
  }
  function normRoom(code) {
    return String(code || '')
      .replace(/\s+/g, '')
      .replace(/[^0-9A-Za-z\uAC00-\uD7A3_-]/g, '')
      .replace(/[a-z]/g, (c) => c.toUpperCase())
      .slice(0, 12);
  }
  function roomValid(code) {
    return typeof code === 'string' && code.length >= 2 && code.length <= 12;
  }
  const roomReady = () => roomValid(share.room) && !!share.url;
  const roomBase = () => `${share.url}/${ROOM_ROOT}/${encodeURIComponent(share.room)}`;
  const roomUrl = () => `${roomBase()}.json`;
  const recordUrl = (id) => `${roomBase()}/records/${encodeURIComponent(id)}.json`;
  const inviteLink = () => `${APP_URL}?room=${encodeURIComponent(share.room)}`;

  function randomRoom() {
    const words = ['뿡뿡', '포근', '말랑', '산뜻', '복숭아', '민트', '하트', '구름'];
    const w = words[Math.floor(Math.random() * words.length)];
    return normRoom(`${w}${Math.floor(Math.random() * 900 + 100)}`);
  }

  function fbRequest(method, url, body) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), REQ_TIMEOUT) : null;
    const opts = { method, cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;
    if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then((res) => {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    }, (err) => {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function fbGet(url) {
    return fbRequest('GET', url).then((txt) => {
      try { return txt ? JSON.parse(txt) : null; } catch (e) { return null; }
    });
  }

  function setMode(mode) {
    if (net.mode === mode) { renderShareState(); return; }
    net.mode = mode;
    renderShareState();
  }

  function renderShareState() {
    const dot = $('shareDot');
    if (dot) dot.dataset.mode = net.mode;
    const st = $('linkStatus');
    if (st) {
      st.dataset.mode = net.mode;
      if (net.mode === 'live') st.textContent = `● 가족 공유 중 (방: ${share.room})`;
      else if (net.mode === 'polling') st.textContent = `● 가족 공유 중 (방: ${share.room}) · 5초마다 확인`;
      else if (net.mode === 'connecting') st.textContent = `연결 중… (방: ${share.room})`;
      else if (net.mode === 'offline') st.textContent = '오프라인 · 이 기기에 먼저 저장하고 있어요';
      else if (net.mode === 'error') st.textContent = '연결하지 못했어요 · 방 코드와 인터넷을 확인해 주세요';
      else st.textContent = '가족 공유 꺼짐 · 이 기기에만 저장돼요';
    }
    const leave = $('linkLeave');
    if (leave) leave.hidden = !share.room;
    const invite = $('linkInvite');
    if (invite) invite.hidden = !share.room;
    const save = $('linkSave');
    if (save) save.textContent = share.room && net.mode !== 'local' ? '연결하기' : '가족 공유 켜기';
    const roomInput = $('roomInput');
    if (roomInput && document.activeElement !== roomInput) roomInput.value = share.room;
  }

  function connectShare(opts) {
    closeStream();
    stopPolling();
    net.synced = false;
    net.fails = 0;
    if (!roomReady()) { setMode('local'); return; }
    if (navigator.onLine === false) { setMode('offline'); return; }
    setMode('connecting');
    openStream();
    if (opts && opts.announce) showToast(`가족 방 ${share.room}에 연결하고 있어요`);
  }

  function openStream() {
    closeStream();
    if (!roomReady()) { setMode('local'); return; }
    if (typeof EventSource !== 'function') { startPolling(); return; }
    let es;
    try {
      es = new EventSource(roomUrl());
    } catch (e) {
      startPolling();
      return;
    }
    net.es = es;
    es.addEventListener('open', () => {
      if (net.es !== es) return;
      net.fails = 0;
      setMode('live');
      afterConnect();
    });
    es.addEventListener('put', (ev) => onStream(ev.data));
    es.addEventListener('patch', (ev) => onStream(ev.data));
    es.onerror = () => {
      if (net.es !== es) return;
      try { es.close(); } catch (e) { /* 무시 */ }
      net.es = null;
      if (navigator.onLine === false) { setMode('offline'); return; }
      startPolling();
    };
  }

  function closeStream() {
    if (net.es) {
      try { net.es.close(); } catch (e) { /* 무시 */ }
      net.es = null;
    }
  }

  function startPolling() {
    closeStream();
    if (!roomReady()) { setMode('local'); return; }
    if (net.pollTimer) return;
    setMode('polling');
    const tick = () => {
      fetchRoom().then(() => { net.fails = 0; if (net.mode !== 'polling') setMode('polling'); })
        .catch(() => {
          net.fails += 1;
          if (navigator.onLine === false) setMode('offline');
          else if (net.fails >= 3) setMode('error');
        });
    };
    tick();
    net.pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (net.pollTimer) { clearInterval(net.pollTimer); net.pollTimer = null; }
  }

  function onStream(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg) return;
    if (msg.path === '/' && msg.data && typeof msg.data === 'object') applyRoom(msg.data);
    else fetchRoom();
  }

  function fetchRoom() {
    return fbGet(roomUrl()).then((data) => {
      applyRoom(data);
      return data;
    });
  }

  function applyRoom(data) {
    const room = (data && typeof data === 'object') ? data : {};
    const remote = room.records && typeof room.records === 'object' ? room.records : {};
    const byId = new Map(state.records.map((r) => [r.id, r]));
    let changed = false;

    Object.keys(remote).forEach((id) => {
      const r = remote[id];
      if (!r || typeof r !== 'object' || typeof r.food !== 'string') return;
      const local = byId.get(id);
      if (!local || (Number(r.updatedAt) || 0) > (Number(local.updatedAt) || 0)) {
        const next = {
          id,
          who: FAMILY.some((f) => f.id === r.who) ? r.who : 'mom',
          food: String(r.food).slice(0, 20),
          emoji: typeof r.emoji === 'string' ? r.emoji : '',
          pic: typeof r.pic === 'string' ? r.pic : '',
          tone: toneOf(r.tone),
          cat: typeof r.cat === 'string' ? r.cat : '',
          stage: stageOf(r.stage).id,
          note: typeof r.note === 'string' ? r.note.slice(0, 120) : '',
          at: typeof r.at === 'string' ? r.at : new Date().toISOString(),
          updatedAt: Number(r.updatedAt) || Date.now(),
          deleted: !!r.deleted,
        };
        if (local) Object.assign(local, next);
        else { state.records.push(next); byId.set(id, next); }
        changed = true;
      }
    });

    if (changed) {
      persist();
      renderBoard();
      renderQuick();
      renderTabCount();
    }

    if (!net.synced) {
      net.synced = true;
      pushLocalMissing(remote);
      flushDirty();
      if (net.mode === 'live' || net.mode === 'polling') {
        const n = memberRecords(who).length;
        showToast(`가족 방 ${share.room} 연결 · 기록 ${n}개`);
      }
    }
  }

  function afterConnect() {
    fetchRoom().catch(() => {});
  }

  function pushLocalMissing(remote) {
    state.records.forEach((r) => {
      if (remote[r.id]) return;
      if (net.dirty.has(r.id)) return;
      fbRequest('PUT', recordUrl(r.id), r).catch(() => {
        net.dirty.add(r.id);
        persistDirty();
      });
    });
  }

  function pushRecord(rec) {
    if (!roomReady()) return;
    if (net.mode === 'local') return;
    fbRequest('PUT', recordUrl(rec.id), rec).then(() => {
      net.dirty.delete(rec.id);
      persistDirty();
    }).catch(() => {
      net.dirty.add(rec.id);
      persistDirty();
    });
  }

  function flushDirty() {
    if (!roomReady() || net.flushing || !net.dirty.size) return;
    net.flushing = true;
    const ids = Array.from(net.dirty);
    const jobs = ids.map((id) => {
      const rec = state.records.find((r) => r.id === id);
      if (!rec) { net.dirty.delete(id); return Promise.resolve(); }
      return fbRequest('PUT', recordUrl(id), rec).then(() => { net.dirty.delete(id); }).catch(() => {});
    });
    Promise.all(jobs).then(() => {
      persistDirty();
      net.flushing = false;
    });
  }

  function saveShareFromSheet() {
    const room = normRoom($('roomInput').value);
    if (!roomValid(room)) {
      $('roomInput').value = room;
      $('roomInput').classList.remove('shake');
      void $('roomInput').offsetWidth;
      $('roomInput').classList.add('shake');
      $('roomInput').focus();
      showToast('방 코드를 2~12글자로 정해 주세요');
      return;
    }
    const changed = room !== share.room;
    share.room = room;
    persistShare();
    closeLink();
    connectShare({ announce: true });
    if (changed) showToast(`가족 방 ${room} · 초대 링크를 보내 보세요`);
  }

  function leaveShare() {
    share.room = '';
    persistShare();
    closeStream();
    stopPolling();
    setMode('local');
    closeLink();
    showToast('가족 공유를 껐어요 · 이 기기에만 저장돼요');
  }

  async function copyInvite() {
    if (!share.room) return;
    const link = inviteLink();
    try {
      await navigator.clipboard.writeText(link);
      showToast('초대 링크를 복사했어요 🔗');
    } catch (e) {
      showToast(`초대 링크 · ${link}`);
    }
  }

  function openLink() {
    renderShareState();
    $('linkWrap').hidden = false;
    lockModals();
    if (share.room) $('roomInput').value = share.room;
  }
  function closeLink() {
    $('linkWrap').hidden = true;
    lockModals();
  }

  /* ───────── 이벤트 ───────── */
  function bind() {
    document.querySelectorAll('.fam').forEach((b) => {
      b.addEventListener('click', () => setWho(b.dataset.who));
    });

    document.querySelectorAll('.tab').forEach((b) => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });

    $('brandHome').addEventListener('click', () => setView('log'));

    $('foodInput').addEventListener('input', renderPreview);
    $('noIconBtn').addEventListener('click', () => {
      noIconNext = !noIconNext;
      renderNoIconToggle();
      lastPreviewKey = '';
      renderPreview();
    });
    $('foodInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveFromInput(pickedStage);
      }
    });

    $('saveBtn').addEventListener('click', () => saveFromInput(pickedStage));

    document.querySelectorAll('.stage').forEach((b) => {
      b.addEventListener('click', () => {
        pickedStage = b.dataset.stage;
        markPicked();
        saveFromInput(b.dataset.stage);
      });
    });

    $('quickRow').addEventListener('click', (e) => {
      const btn = e.target.closest('.quick');
      if (!btn) return;
      $('foodInput').value = btn.dataset.food;
      renderPreview();
      $('foodInput').focus();
    });

    $('board').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const rec = state.records.find((r) => r.id === chip.dataset.id && !r.deleted);
      if (!rec) return;
      playStage(rec.stage);
      setTimeout(() => openDetail(rec.id), 90);
    });

    $('soundBtn').addEventListener('click', () => {
      sound.on = !sound.on;
      persistSound();
      renderSound();
      if (sound.on) {
        playStage('single');
        showToast('소리를 켰어요 🔊');
      } else {
        showToast('소리를 껐어요 🔇');
      }
    });

    $('shareCardBtn').addEventListener('click', openShare);
    $('shareClose').addEventListener('click', closeShare);
    $('shareSave').addEventListener('click', saveCard);
    $('shareSend').addEventListener('click', sendCard);

    $('detailClose').addEventListener('click', closeDetail);
    $('detailSave').addEventListener('click', saveDetail);
    $('detailDelete').addEventListener('click', () => {
      if (!deleteArmed) { armDelete(true); showToast('한 번 더 누르면 삭제돼요'); return; }
      deleteRecord();
    });
    document.querySelectorAll('#detailStages button').forEach((b) => {
      b.addEventListener('click', () => {
        draftStage = b.dataset.stage;
        renderDetailStages();
        playStage(b.dataset.stage);
      });
    });
    $('emojiGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-emoji], button[data-pic]');
      if (!btn) return;
      const rec = state.records.find((r) => r.id === editingId && !r.deleted);
      if (btn.dataset.emoji === 'none') {
        draftNoIcon = true;
        draftEmoji = '';
        draftPic = '';
        paintDetailFace(rec);
        renderEmojiGrid();
        return;
      }
      if (btn.dataset.pic) {
        draftNoIcon = false;
        draftPic = btn.dataset.pic;
        draftEmoji = '';
        const f = FOODS.find((x) => x.p === draftPic);
        draftTone = f ? toneOf(f.t) : draftTone;
        $('detailCircle').dataset.tone = draftTone;
        paintDetailFace(rec);
        renderEmojiGrid();
        return;
      }
      draftNoIcon = false;
      draftPic = '';
      draftEmoji = btn.dataset.emoji;
      const f = FOODS.find((x) => x.e === draftEmoji);
      draftTone = f ? toneOf(f.t) : draftTone;
      $('detailCircle').dataset.tone = draftTone;
      paintDetailFace(rec);
      renderEmojiGrid();
    });

    $('linkBtn').addEventListener('click', openLink);
    $('linkClose').addEventListener('click', closeLink);
    $('linkSave').addEventListener('click', saveShareFromSheet);
    $('linkLeave').addEventListener('click', leaveShare);
    $('linkInvite').addEventListener('click', copyInvite);
    $('roomNew').addEventListener('click', () => {
      $('roomInput').value = randomRoom();
    });
    $('roomInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveShareFromSheet(); });

    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const which = el.dataset.close;
        if (which === 'detail') closeDetail();
        else if (which === 'share') closeShare();
        else if (which === 'link') closeLink();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('detailWrap').hidden) closeDetail();
      else if (!$('shareWrap').hidden) closeShare();
      else if (!$('linkWrap').hidden) closeLink();
    });

    window.addEventListener('online', () => { if (roomReady()) connectShare(); });
    window.addEventListener('offline', () => { if (roomReady()) setMode('offline'); });
  }

  function renderSound() {
    const btn = $('soundBtn');
    btn.textContent = sound.on ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', sound.on ? 'true' : 'false');
    btn.setAttribute('aria-label', sound.on ? '소리 끄기' : '소리 켜기');
  }

  // '그림 없이 글자만' 토글 상태
  function renderNoIconToggle() {
    const b = $('noIconBtn');
    if (!b) return;
    b.setAttribute('aria-pressed', noIconNext ? 'true' : 'false');
    b.textContent = noIconNext ? '글자만 보기 켜짐' : '그림 없이 글자만';
  }

  /* ───────── 시작 ───────── */
  function init() {
    load();
    renderFamily();
    renderSound();
    renderNoIconToggle();
    markPicked();
    renderLog();
    renderBoard();
    bind();
    setView('log', { silent: true });
    ensureArt();

    if (roomReady()) {
      setMode('connecting');
      setTimeout(() => connectShare(), 350);
    } else {
      setMode('local');
    }

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    window.__bbung = {
      version: '3',
      get records() { return state.records.slice(); },
      get who() { return who; },
      get share() { return { url: share.url, room: share.room }; },
      get mode() { return net.mode; },
      photos: FAMILY.map((f) => f.photo),
      artReady: () => ensureArt().then(() => Object.keys(art.photos).filter((k) => !!art.photos[k]).length),
      get boardCount() { return $('board').querySelectorAll('.chip').length; },
      soundLog: sound.log,
      foods: FOODS.length,
      pics: PIC_ORDER.length,
      picNames: { ...PIC_NAMES },
      aliases: Object.keys(ALIASES).length,
      findFood: (q) => { const f = findFood(q); return f ? { n: f.n, e: f.e, c: f.c, p: f.p || '' } : null; },
      picFor: (food) => picForRecord({ food }),
      openDetail,
      isMuted: () => !sound.on,
    };
    document.documentElement.dataset.ready = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
