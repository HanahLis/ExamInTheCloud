import type { Language } from '../locales/i18nContext';

export interface CountryDomainConfig {
  countryId: string;
  domain: string;
  nameKey: string;
  defaultLang: Language;
  flag: string;
  subdomain: string;
}

export const COUNTRY_DOMAINS: Record<string, CountryDomainConfig> = {
  vn: {
    countryId: 'vn',
    domain: 'vn.cloudexam.id.vn',
    nameKey: 'country_vn',
    defaultLang: 'vi',
    flag: '🇻🇳',
    subdomain: 'vn',
  },
  us: {
    countryId: 'us',
    domain: 'us.cloudexam.id.vn',
    nameKey: 'country_us',
    defaultLang: 'en',
    flag: '🇺🇸',
    subdomain: 'us',
  },
  la: {
    countryId: 'la',
    domain: 'lao.cloudexam.id.vn',
    nameKey: 'country_la',
    defaultLang: 'la',
    flag: '🇱🇦',
    subdomain: 'lao',
  },
  de: {
    countryId: 'de',
    domain: 'de.cloudexam.id.vn',
    nameKey: 'country_de',
    defaultLang: 'de',
    flag: '🇩🇪',
    subdomain: 'de',
  },
  default: {
    countryId: 'default',
    domain: 'cloudexam.id.vn',
    nameKey: 'country_intl',
    defaultLang: 'vi',
    flag: '🌐',
    subdomain: 'global',
  },
};

/**
 * Tự động phát hiện Quốc gia và Ngôn ngữ từ Hostname / Domain hiện tại.
 * Hỗ trợ tham số URL '?domain=...' hoặc '?country=...' để kiểm thử tức thì trên localhost.
 */
export const detectCountryFromLocation = (): {
  countryId: string;
  lang: Language;
  domain: string;
  isCustomDomain: boolean;
} => {
  if (typeof window === 'undefined') {
    return {
      countryId: 'vn',
      lang: 'vi',
      domain: COUNTRY_DOMAINS.vn.domain,
      isCustomDomain: false,
    };
  }

  const hostname = (window.location.hostname || '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const paramDomain = (searchParams.get('domain') || searchParams.get('host') || '').toLowerCase();
  const paramCountry = (searchParams.get('country') || '').toLowerCase();

  // 1. Kiểm tra tham số thử nghiệm domain/country trên URL (hỗ trợ test trên dev server)
  if (paramCountry && COUNTRY_DOMAINS[paramCountry]) {
    const cfg = COUNTRY_DOMAINS[paramCountry];
    return { countryId: cfg.countryId, lang: cfg.defaultLang, domain: cfg.domain, isCustomDomain: true };
  }

  const targetHost = paramDomain || hostname;
  const firstSub = targetHost.split('.')[0]; // Ví dụ: "vn", "lao", "us", "de"

  // 2. Phát hiện theo tên miền Lào: lao.cloudexam.id.vn, la.cloudexam.id.vn, edulao.la
  if (['lao', 'laos', 'la', 'edulao'].includes(firstSub) || targetHost.includes('edulao')) {
    return {
      countryId: 'la',
      lang: 'la',
      domain: COUNTRY_DOMAINS.la.domain,
      isCustomDomain: true,
    };
  }

  // 3. Phát hiện theo tên miền Đức: de.cloudexam.id.vn, germany.cloudexam.id.vn, deutschland.cloudexam.id.vn
  if (['de', 'germany', 'deutschland'].includes(firstSub)) {
    return {
      countryId: 'de',
      lang: 'de',
      domain: COUNTRY_DOMAINS.de.domain,
      isCustomDomain: true,
    };
  }

  // 4. Phát hiện theo tên miền Mỹ / Quốc tế (Tiếng Anh): us.cloudexam.id.vn, en.cloudexam.id.vn
  if (['us', 'en', 'uk', 'global', 'intl', 'international'].includes(firstSub)) {
    return {
      countryId: 'us',
      lang: 'en',
      domain: COUNTRY_DOMAINS.us.domain,
      isCustomDomain: true,
    };
  }

  // 5. Phát hiện theo tên miền Việt Nam: vn.cloudexam.id.vn, vietnam.cloudexam.id.vn
  if (['vn', 'vietnam', 'viet'].includes(firstSub)) {
    return {
      countryId: 'vn',
      lang: 'vi',
      domain: COUNTRY_DOMAINS.vn.domain,
      isCustomDomain: true,
    };
  }

  // 6. Trên môi trường dev localhost hoặc domain gốc cloudexam.id.vn không truyền subdomain: ưu tiên lấy từ localStorage đã lưu
  const savedCountry = localStorage.getItem('cloudexam_theme') || 'vn';
  const cfg = COUNTRY_DOMAINS[savedCountry] || COUNTRY_DOMAINS.vn;

  return {
    countryId: cfg.countryId,
    lang: cfg.defaultLang,
    domain: cfg.domain,
    isCustomDomain: false,
  };
};

/**
 * Chuyển đổi tên miền tương ứng khi người dùng chọn Quốc gia
 */
export const switchCountryDomain = (targetCountryId: string) => {
  if (typeof window === 'undefined') return;

  const target = COUNTRY_DOMAINS[targetCountryId] || COUNTRY_DOMAINS.default;
  const hostname = window.location.hostname.toLowerCase();
  const port = window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('cloudexam.id.vn') || hostname.includes('cloudexam.com')) {
    // Đang chạy trên domain thật: chuyển hướng sang subdomain tương ứng
    if (hostname !== target.domain) {
      window.location.href = `${window.location.protocol}//${target.domain}${port}${window.location.pathname}${window.location.search}`;
    }
  } else {
    // Đang chạy trên localhost/IP: cập nhật tham số ?country=... để kiểm thử tức thì
    const url = new URL(window.location.href);
    url.searchParams.set('country', targetCountryId);
    window.history.replaceState({}, '', url.toString());
  }
};

