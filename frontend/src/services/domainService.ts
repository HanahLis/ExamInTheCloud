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
    domain: 'vietnam.cloudexam.com',
    nameKey: 'country_vn',
    defaultLang: 'vi',
    flag: '🇻🇳',
    subdomain: 'vietnam',
  },
  la: {
    countryId: 'la',
    domain: 'lao.cloudexam.com',
    nameKey: 'country_la',
    defaultLang: 'la',
    flag: '🇱🇦',
    subdomain: 'lao',
  },
  de: {
    countryId: 'de',
    domain: 'germany.cloudexam.com',
    nameKey: 'country_de',
    defaultLang: 'de',
    flag: '🇩🇪',
    subdomain: 'germany',
  },
  default: {
    countryId: 'default',
    domain: 'cloudexam.com',
    nameKey: 'country_intl',
    defaultLang: 'en',
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
  const firstSub = targetHost.split('.')[0]; // Ví dụ: "lao" từ "lao.cloudexam.com" hoặc "vietnam" từ "vietnam.cloudexam.com"

  // 2. Phát hiện theo tên miền Lào: lao.cloudexam.com, laos.cloudexam.com, la.cloudexam.com, edulao.la
  if (['lao', 'laos', 'la', 'edulao'].includes(firstSub) || targetHost.includes('edulao')) {
    return {
      countryId: 'la',
      lang: 'la',
      domain: COUNTRY_DOMAINS.la.domain,
      isCustomDomain: true,
    };
  }

  // 3. Phát hiện theo tên miền Đức: germany.cloudexam.com, deutschland.cloudexam.com, de.cloudexam.com
  if (['germany', 'de', 'deutschland'].includes(firstSub)) {
    return {
      countryId: 'de',
      lang: 'de',
      domain: COUNTRY_DOMAINS.de.domain,
      isCustomDomain: true,
    };
  }

  // 4. Phát hiện theo tên miền Việt Nam: vietnam.cloudexam.com, vn.cloudexam.com
  if (['vietnam', 'vn', 'viet'].includes(firstSub)) {
    return {
      countryId: 'vn',
      lang: 'vi',
      domain: COUNTRY_DOMAINS.vn.domain,
      isCustomDomain: true,
    };
  }

  // 5. Tên miền quốc tế mặc định: cloudexam.com, global.cloudexam.com, intl.cloudexam.com
  if (
    ['global', 'intl', 'international', 'en'].includes(firstSub) ||
    targetHost === 'cloudexam.com' ||
    targetHost === 'www.cloudexam.com'
  ) {
    return {
      countryId: 'default',
      lang: 'en',
      domain: COUNTRY_DOMAINS.default.domain,
      isCustomDomain: true,
    };
  }

  // 6. Trên môi trường dev localhost không truyền tham số: ưu tiên lấy từ localStorage đã lưu
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
  const hostname = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('cloudexam.com')) {
    // Đang chạy trên domain thật hoặc qua /etc/hosts giả lập: chuyển hướng trực tiếp domain
    if (hostname !== target.domain) {
      window.location.href = `${window.location.protocol}//${target.domain}${port}${window.location.pathname}${window.location.search}`;
    }
  } else {
    // Đang chạy trên localhost/IP: cập nhật tham số ?domain=... để kiểm thử tức thì
    const url = new URL(window.location.href);
    url.searchParams.set('domain', target.domain);
    window.history.replaceState({}, '', url.toString());
  }
};

