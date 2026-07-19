'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE_NAME, localeCookieOptions } from '@/i18n/locale';
import type { Locale } from '@/i18n/config';

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, localeCookieOptions);
}
