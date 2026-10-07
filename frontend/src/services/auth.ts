const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI;

// 1. Chuyển hướng sang Cognito Hosted UI
export const redirectToCognitoLogin = () => {
  const loginUrl = `${DOMAIN}/login?client_id=${CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.href = loginUrl;
};

// 2. Trích xuất Token từ URL sau khi Cognito redirect về trang /callback
export const handleAuthCallback = () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');

  if (idToken && accessToken) {
    localStorage.setItem('id_token', idToken);
    localStorage.setItem('access_token', accessToken);
    window.location.href = '/'; // Quay về trang chính
  }
};

export const logout = () => {
  localStorage.clear();
  const logoutUrl = `${DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.location.href = logoutUrl;
};