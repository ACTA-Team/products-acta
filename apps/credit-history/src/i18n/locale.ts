import { defaultLocale, locales, type Locale } from './config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

function matchAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const tag of preferred) {
    if (tag.startsWith('es')) {
      return 'es';
    }
    if (tag.startsWith('en')) {
      return 'en';
    }
  }

  return defaultLocale;
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null
): Locale {
  if (isLocale(cookieValue)) {
    return cookieValue;
  }

  return matchAcceptLanguage(acceptLanguage);
}

export const localeCookieOptions = {
  path: '/',
  maxAge: ONE_YEAR_SECONDS,
  sameSite: 'lax' as const,
};
