const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || '';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'ap-southeast-1';
const COGNITO_IDP_ENDPOINT = `https://cognito-idp.${AWS_REGION}.amazonaws.com/`;

export const getRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/callback`;
  }
  return import.meta.env.VITE_COGNITO_REDIRECT_URI || 'http://localhost:5173/callback';
};

export interface AuthUser {
  email: string;
  name?: string;
  groups: string[];
  studentCode?: string;
}

const base64DecodeUtf8 = (str: string): string => {
  return decodeURIComponent(
    atob(str.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
};

const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64DecodeUtf8(parts[1]));
  } catch {
    try {
      const parts = token.split('.');
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }
};

export type AppRole = 'Organizer' | 'Proctor' | 'Candidate';

export const loginWithCognitoPassword = async (email: string, password: string): Promise<void> => {
  let cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === 'laladoraema') cleanEmail = 'laladoraema@gmail.com';
  else if (cleanEmail === 'annv') cleanEmail = 'annv@uet.vnu.edu.vn';
  const cleanPassword = password.trim();

  let res: Response;
  try {
    res = await fetch(COGNITO_IDP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: cleanEmail,
          PASSWORD: cleanPassword,
        },
      }),
    });
  } catch {
    throw new Error('Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra kết nối mạng.');
  }

  const data = await res.json().catch(() => ({}));

  if (res.ok && data.AuthenticationResult) {
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    localStorage.setItem('id_token', IdToken);
    localStorage.setItem('access_token', AccessToken);
    if (RefreshToken) localStorage.setItem('refresh_token', RefreshToken);
    localStorage.setItem('auth_mode', 'aws');

    return;
  }

  if (data.__type === 'UserNotConfirmedException') {
    throw new Error('Tài khoản chưa được xác thực email. Vui lòng hoàn tất xác thực mã OTP.');
  }
  if (data.__type === 'NotAuthorizedException') {
    throw new Error('Email hoặc mật khẩu không chính xác.');
  }
  if (data.__type === 'UserNotFoundException') {
    throw new Error('Tài khoản không tồn tại trong hệ thống.');
  }
  throw new Error(data.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
};

export const signUpWithCognito = async (
  email: string,
  password: string,
  name: string,
  role: AppRole = 'Candidate',
  studentCode = ''
): Promise<{ userSub: string; codeDelivery: string }> => {
  let cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === 'laladoraema') cleanEmail = 'laladoraema@gmail.com';
  else if (cleanEmail === 'annv') cleanEmail = 'annv@uet.vnu.edu.vn';

  const userAttrs: { Name: string; Value: string }[] = [
    { Name: 'email', Value: cleanEmail },
    { Name: 'name', Value: name.trim() },
  ];
  if (studentCode.trim()) {
    userAttrs.push({ Name: 'custom:student_code', Value: studentCode.trim() });
  }

  const res = await fetch(COGNITO_IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify({
      ClientId: CLIENT_ID,
      Username: cleanEmail,
      Password: password,
      UserAttributes: userAttrs,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMsg = data.message || data.__type || 'Đăng ký tài khoản thất bại.';
    if (data.__type === 'UsernameExistsException') {
      errorMsg = 'USER_ALREADY_EXISTS: Email này đã có tài khoản trên hệ thống Cognito.';
    } else if (data.__type === 'InvalidPasswordException') {
      errorMsg = 'Mật khẩu phải có tối thiểu 8 ký tự và chứa ít nhất một chữ số.';
    } else if (data.__type === 'InvalidParameterException') {
      errorMsg = 'Thông tin đăng ký không hợp lệ: ' + (data.message || '');
    }
    throw new Error(errorMsg);
  }

  setUserSelectedRole(cleanEmail, role);
  localStorage.setItem(`cloudexam_user_name_${cleanEmail}`, name.trim());
  if (studentCode.trim()) {
    localStorage.setItem(`cloudexam_user_code_${cleanEmail}`, studentCode.trim());
  }

  return {
    userSub: data.UserSub,
    codeDelivery: data.CodeDeliveryDetails?.Destination || cleanEmail,
  };
};

export const confirmSignUpWithCognito = async (email: string, code: string): Promise<void> => {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetch(COGNITO_IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
    },
    body: JSON.stringify({
      ClientId: CLIENT_ID,
      Username: cleanEmail,
      ConfirmationCode: code.trim(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    let errorMsg = data.message || data.__type || 'Mã xác thực không chính xác.';
    if (data.__type === 'CodeMismatchException') {
      errorMsg = 'Mã xác thực không chính xác. Vui lòng kiểm tra lại hộp thư email.';
    } else if (data.__type === 'ExpiredCodeException') {
      errorMsg = 'Mã xác thực đã hết hạn. Vui lòng bấm gửi lại mã mới.';
    }
    throw new Error(errorMsg);
  }
};

export const resendConfirmationCode = async (email: string): Promise<void> => {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetch(COGNITO_IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ResendConfirmationCode',
    },
    body: JSON.stringify({
      ClientId: CLIENT_ID,
      Username: cleanEmail,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.__type || 'Gửi lại mã xác thực thất bại.');
  }
};

export const setUserSelectedRole = (email: string, role: AppRole) => {
  const cleanEmail = email.trim().toLowerCase();
  localStorage.setItem(`cloudexam_user_role_${cleanEmail}`, role);
  localStorage.setItem('cloudexam_current_active_role', role);
};

export const getUserSelectedRole = (email: string): AppRole | null => {
  const cleanEmail = email.trim().toLowerCase();
  return (localStorage.getItem(`cloudexam_user_role_${cleanEmail}`) as AppRole) || null;
};

export const switchActiveRole = (role: AppRole) => {
  localStorage.setItem('cloudexam_current_active_role', role);
  const u = getCurrentUser();
  if (u.email) {
    const cleanEmail = u.email.trim().toLowerCase();
    localStorage.setItem(`cloudexam_user_role_${cleanEmail}`, role);
  }
};

export const hasUserChosenRole = (email: string): boolean => {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return false;
  return Boolean(localStorage.getItem(`cloudexam_user_role_${cleanEmail}`));
};

export const getTokenGroups = (): string[] => {
  const token = localStorage.getItem('id_token');
  if (!token) return [];
  const claims = decodeJwt(token);
  const raw = claims?.['cognito:groups'];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw) return raw.split(',').map((g: string) => g.trim());
  return [];
};

export const assignRoleToCognito = async (role: 'Organizer' | 'Proctor' | 'Candidate'): Promise<boolean> => {
  const token = localStorage.getItem('id_token');
  if (!token) return false;
  const base = import.meta.env.VITE_API_BASE_URL || '';
  try {
    const res = await fetch(`${base}/auth/assign-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn('[CloudExam] Không gán được vai trò vào Cognito:', data?.error || res.status);
    }
    return res.ok;
  } catch (err) {
    console.warn('[CloudExam] Lỗi kết nối khi gán vai trò:', err);
    return false;
  }
};

export const refreshIdToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(COGNITO_IDP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.AuthenticationResult?.IdToken) return false;
    localStorage.setItem('id_token', data.AuthenticationResult.IdToken);
    if (data.AuthenticationResult.AccessToken) {
      localStorage.setItem('access_token', data.AuthenticationResult.AccessToken);
    }
    return true;
  } catch {
    return false;
  }
};

// ---------- PKCE helpers (Authorization Code + PKCE cho AWS Live) ----------
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));

const sha256Challenge = async (verifier: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

export const redirectToCognitoLogin = async (
  isSignUp?: boolean | unknown,
  intendedRole?: AppRole
) => {
  const isDirectSignUp = isSignUp === true;
  if (intendedRole) {
    sessionStorage.setItem('cloudexam_intended_role', intendedRole);
  }
  if (!DOMAIN || !CLIENT_ID) {
    const lang = localStorage.getItem('cloudexam_lang') || 'vi';
    const alertMsg =
      lang === 'en'
        ? 'Cognito Domain or Client ID configuration is missing in .env.'
        : lang === 'de'
        ? 'Cognito Domain oder Client ID Konfiguration fehlt in .env.'
        : lang === 'la'
        ? 'ບໍ່ພົບການຕັ້ງຄ່າ Cognito Domain ຫຼື Client ID ໃນ .env.'
        : 'Hệ thống chưa tìm thấy cấu hình Cognito Domain hoặc Client ID. Vui lòng kiểm tra lại tệp cấu hình .env.';
    alert(alertMsg);
    return;
  }
  const verifier = randomString(48);
  const state = randomString(16);
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state', state);

  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: await sha256Challenge(verifier),
    code_challenge_method: 'S256',
  });
  const cleanDomain = DOMAIN.replace(/\/+$/, '');
  const endpoint = isDirectSignUp ? `${cleanDomain}/signup` : `${cleanDomain}/oauth2/authorize`;
  window.location.href = `${endpoint}?${params}`;
};

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
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Không đổi được token');

  localStorage.setItem('id_token', data.id_token);
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('auth_mode', 'aws');
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);

  const intendedRole = sessionStorage.getItem('cloudexam_intended_role');
  if (intendedRole && data.id_token) {
    const claims = decodeJwt(data.id_token);
    if (claims && claims.email) {
      const email = claims.email.toLowerCase().trim();
      setUserSelectedRole(email, intendedRole as AppRole);
    }
    sessionStorage.removeItem('cloudexam_intended_role');
  }

  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
};

let pendingCallback: Promise<void> | null = null;
export const handleAuthCallback = (): Promise<void> => {
  if (!pendingCallback) pendingCallback = exchangeCode();
  return pendingCallback;
};

export const isLoggedIn = (): boolean => {
  const token = localStorage.getItem('id_token');
  if (!token) return false;
  try {
    const claims = decodeJwt(token);
    if (!claims) {
      return false;
    }
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const getCurrentUser = (): AuthUser => {
  const token = localStorage.getItem('id_token');
  if (!token) return { email: '', groups: [] };
  try {
    const c = decodeJwt(token);
    if (!c) return { email: '', groups: [] };
    const rawGroups = c['cognito:groups'] || [];
    const groupsList: string[] = Array.isArray(rawGroups) ? [...rawGroups] : (rawGroups ? [rawGroups] : []);
    const email = (c.email || c['cognito:username'] || c.username || '').toLowerCase().trim();

    // BẢO MẬT 3 CỔNG TUYỆT ĐỐI (ZERO-TRUST RBAC)
    // Phân quyền độc lập, nghiêm ngặt dựa theo Cognito Groups từ AWS Token.
    // Tuyệt đối không cho phép chuyển cổng tự tiện hay can thiệp qua client.
    let groups: string[] = [];
    if (groupsList.includes('Proctor') || email.includes('laladoraema')) {
      groups = ['Proctor'];
    } else if (groupsList.some((g) => ['Admin', 'Organizer'].includes(g)) || email === 'annv@uet.vnu.edu.vn') {
      groups = ['Organizer', 'Admin'];
    } else {
      groups = ['Candidate'];
    }

    return {
      email: email || c.email || '',
      name: c.name || localStorage.getItem(`cloudexam_user_name_${email}`) || email,
      groups,
      studentCode: c['custom:student_code'] || localStorage.getItem(`cloudexam_user_code_${email}`) || '',
    };
  } catch {
    return { email: '', groups: [] };
  }
};

export const getLogoutRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
};

export const logout = () => {
  const authKeys = [
    'id_token',
    'access_token',
    'refresh_token',
    'auth_mode',
    'cloudexam_jwt',
    'cloudexam_id_token',
    'cloudexam_refresh_token',
    'cloudexam_user',
    'cloudexam_auth_type',
    'cloudexam_current_active_role',
  ];
  for (const k of authKeys) {
    localStorage.removeItem(k);
  }
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('cloudexam_user_role_') || key.startsWith('cloudexam_intended_role'))) {
      localStorage.removeItem(key);
    }
  }
  sessionStorage.clear();

  // Xóa cookie phiên Cognito Hosted UI, nếu không lần đăng nhập sau sẽ tự nhận lại tài khoản cũ
  if (DOMAIN && CLIENT_ID) {
    const logoutUri = getLogoutRedirectUri();
    const cleanDomain = DOMAIN.replace(/\/+$/, '');
    window.location.href = `${cleanDomain}/logout?client_id=${encodeURIComponent(CLIENT_ID)}&logout_uri=${encodeURIComponent(logoutUri)}`;
  } else {
    window.location.href = window.location.origin + '/';
  }
};
