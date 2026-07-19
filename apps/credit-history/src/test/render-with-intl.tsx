import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/i18n/messages/en.json';

/**
 * Render a component wrapped in a real `NextIntlClientProvider` using the app's
 * English messages, so translation keys resolve to actual copy in assertions.
 * `timeZone` is fixed to keep date formatting deterministic across machines.
 */
export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
