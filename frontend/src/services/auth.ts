const MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN; // gồm cả https://
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI;

export interface AuthUser {
  email: string;
  groups: string[];
  studentCode?: string;
}

const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

// Tạo JWT giả lập có cấu trúc Claims y hệt AWS Cognito User Pool Token
export const createMockJwt = (email: string, groups: string[], studentCode = '') => {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: `user-${Math.random().toString(36).substring(2, 10)}`,
      email,
      'cognito:groups': groups,
      'custom:student_code': studentCode,
      iss: 'https://cognito-idp.ap-southeast-1.amazonaws.com/mock-pool',
      exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 giờ
    })
  );
  return `${header}.${payload}.mock-signature-aws`;
};

// Đăng nhập trực tiếp với tài khoản chọn (Mock / Demo có sẵn dữ liệu)
export const loginWithMockAccount = (email: string, groups: string[], studentCode = '') => {
  const token = createMockJwt(email, groups, studentCode);
  localStorage.setItem('id_token', token);
  localStorage.setItem('access_token', token);
  localStorage.setItem('auth_mode', 'mock');
  return token;
};

// ---------- PKCE helpers (Authorization Code + PKCE cho AWS Live) ----------
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));

const sha256Challenge = async (verifier: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

// 1. Chuyển hướng sang Cognito Hosted UI (Khi MOCK=false)
export const redirectToCognitoLogin = async () => {
  if (MOCK) {
    // Nếu vẫn ở mock, mặc định cấp token Organizer
    loginWithMockAccount('organizer@cloudexam.vn', ['Organizer']);
    window.location.href = '/';
    return;
  }
  const verifier = randomString(48);
  const state = randomString(16);
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    state,
    code_challenge: await sha256Challenge(verifier),
    code_challenge_method: 'S256',
  });
  window.location.href = `${DOMAIN}/oauth2/authorize?${params}`;
};

// 2. Đổi `code` (trên URL /callback?code=...) lấy token thật từ Cognito
const exchangeCode = async () => {
  const q = new URLSearchParams(window.location.search);

  if (q.get('error')) {
    throw new Error(q.get('error_description') || q.get('error') || 'Đăng nhập thất bại');
  }
  const code = q.get('code');
  if (!code) throw new Error('Không tìm thấy mã xác thực (code) trên URL.');

  if (q.get('state') !== sessionStorage.getItem('pkce_state')) {
    throw new Error('State không khớp. Hãy thử đăng nhập lại.');
  }
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Thiếu code_verifier. Hãy thử đăng nhập lại.');

  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Không đổi được token');

  localStorage.setItem('id_token', data.id_token);
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('auth_mode', 'aws'); // Đăng nhập qua AWS Cognito thật
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
};

let pendingCallback: Promise<void> | null = null;
export const handleAuthCallback = (): Promise<void> => {
  if (!pendingCallback) pendingCallback = exchangeCode();
  return pendingCallback;
};

// 3. Phân biệt phiên đăng nhập: Tài khoản thử nghiệm (Mock) vs Tài khoản AWS Cloud Live
export const isMockSession = (): boolean => {
  const mode = localStorage.getItem('auth_mode');
  if (mode === 'aws') return false;
  if (mode === 'mock') return true;
  const token = localStorage.getItem('id_token');
  if (!token) return true;
  return token.endsWith('.mock-signature-aws') || token.startsWith('mock-');
};

// 4. Kiểm tra đã đăng nhập và token chưa hết hạn
export const isLoggedIn = (): boolean => {
  const token = localStorage.getItem('id_token');
  if (!token) return false;
  try {
    const claims = decodeJwt(token);
    if (!claims) {
      localStorage.clear();
      return false;
    }
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      localStorage.clear();
      return false;
    }
    return true;
  } catch {
    localStorage.clear();
    return false;
  }
};

// 4. Thông tin hiển thị trên header (giải mã Claims từ JWT)
export const getCurrentUser = (): AuthUser => {
  const token = localStorage.getItem('id_token');
  if (!token) return { email: '', groups: [] };
  try {
    const c = decodeJwt(token);
    if (!c) return { email: '', groups: [] };
    const rawGroups = c['cognito:groups'] || [];
    const groups = Array.isArray(rawGroups) ? rawGroups : [rawGroups];
    return {
      email: c.email || '',
      groups,
      studentCode: c['custom:student_code'] || '',
    };
  } catch {
    return { email: '', groups: [] };
  }
};

// 5. Đăng xuất
export const logout = () => {
  localStorage.clear();
  sessionStorage.clear();
  if (MOCK || !DOMAIN) {
    window.location.href = '/';
    return;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin + '/',
  });
  window.location.href = `${DOMAIN}/logout?${params}`;
};