const MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN; // gồm cả https://
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI;

const decodeJwt = (token: string) =>
  JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

// ---------- PKCE helpers (Authorization Code + PKCE, không cần thư viện) ----------
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));

const sha256Challenge = async (verifier: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

// 1. Chuyển hướng sang Cognito Hosted UI (mock: vào thẳng)
export const redirectToCognitoLogin = async () => {
  if (MOCK) {
    localStorage.setItem('id_token', 'mock');
    localStorage.setItem('access_token', 'mock');
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

// 2. Đổi `code` (trên URL /callback?code=...) lấy token
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
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
};

// React StrictMode chạy effect 2 lần ở dev, nhưng `code` chỉ dùng được 1 lần nên cache lại promise
let pendingCallback: Promise<void> | null = null;
export const handleAuthCallback = (): Promise<void> => {
  if (!pendingCallback) pendingCallback = exchangeCode();
  return pendingCallback;
};

// 3. Kiểm tra đã đăng nhập và token chưa hết hạn
export const isLoggedIn = (): boolean => {
  const token = localStorage.getItem('id_token');
  if (!token) return false;
  if (MOCK) return true;
  try {
    const { exp } = decodeJwt(token);
    if (exp * 1000 < Date.now()) {
      localStorage.clear();
      return false;
    }
    return true;
  } catch {
    localStorage.clear();
    return false;
  }
};

// 4. Thông tin hiển thị trên header
export const getCurrentUser = (): { email: string; groups: string[] } => {
  const token = localStorage.getItem('id_token');
  if (!token) return { email: '', groups: [] };
  if (MOCK) return { email: 'organizer@test.com (mock)', groups: ['Organizer'] };
  try {
    const c = decodeJwt(token);
    return { email: c.email ?? '', groups: c['cognito:groups'] ?? [] };
  } catch {
    return { email: '', groups: [] };
  }
};

// 5. Đăng xuất. logout_uri phải nằm trong "Allowed sign-out URLs" của App client
export const logout = () => {
  localStorage.clear();
  sessionStorage.clear();
  if (MOCK) {
    window.location.href = '/';
    return;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin + '/',
  });
  window.location.href = `${DOMAIN}/logout?${params}`;
};