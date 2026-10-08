const MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN; // gồm cả https://
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI;
 
const decodeJwt = (token: string) =>
  JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
 
// 1. Chuyển hướng sang Cognito Hosted UI (mock: vào thẳng)
export const redirectToCognitoLogin = () => {
  if (MOCK) {
    localStorage.setItem('id_token', 'mock');
    localStorage.setItem('access_token', 'mock');
    window.location.href = '/';
    return;
  }
  window.location.href =
    `${DOMAIN}/login?client_id=${CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
};
 
// 2. Bóc token từ URL sau khi Cognito redirect về /callback
export const handleAuthCallback = () => {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  if (idToken && accessToken) {
    localStorage.setItem('id_token', idToken);
    localStorage.setItem('access_token', accessToken);
  }
  window.location.replace('/'); // luôn về trang chính, token không còn nằm trên URL
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
  if (MOCK) {
    window.location.href = '/';
    return;
  }
  window.location.href =
    `${DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(window.location.origin + '/')}`;
};
