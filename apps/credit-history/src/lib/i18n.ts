import en from '../dictionaries/en.json';

type Dictionary = typeof en;
type DictionaryKey = keyof Dictionary;

export function t<K extends DictionaryKey>(
  key: K,
  replacements?: Record<string, string | number>
): string {
  let value = en[key] || String(key);
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      value = value.replace(new RegExp(`{${k}}`, 'g'), String(v));
    });
  }
  return value;
}
