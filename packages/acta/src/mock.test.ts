import { describe, expect, it } from 'vitest';
import { FIXTURES, getCredentialSource, type MockMode } from './mock';

// getCredentialSource returns a MockCredentialSource; exercising it through the
// public factory covers the class without reaching into private internals.
function source(mode: MockMode) {
  return getCredentialSource({ mode, delayMs: 0 });
}

describe('MockCredentialSource — normal mode', () => {
  it('listCredentials returns the full fixture set', async () => {
    const list = await source('normal').listCredentials();
    expect(list).toHaveLength(FIXTURES.length);
    expect(list.map((c) => c.id)).toEqual(FIXTURES.map((c) => c.id));
  });

  it('listCredentials returns a fresh array (not the fixture reference)', async () => {
    const list = await source('normal').listCredentials();
    expect(list).not.toBe(FIXTURES);
  });

  it('getCredential resolves a known id and null for an unknown one', async () => {
    const src = source('normal');
    const found = await src.getCredential('cred-income-anchor-payroll');
    expect(found?.id).toBe('cred-income-anchor-payroll');
    expect(await src.getCredential('does-not-exist')).toBeNull();
  });

  it('getProfileSummary derives a populated summary', async () => {
    const summary = await source('normal').getProfileSummary();
    expect(summary.holderName).toBe('Alex Mercer');
    expect(summary.activeCredentialsCount).toBeGreaterThan(0);
  });
});

describe('MockCredentialSource — empty mode', () => {
  it('listCredentials returns an empty array', async () => {
    expect(await source('empty').listCredentials()).toEqual([]);
  });

  it('getCredential returns null', async () => {
    expect(await source('empty').getCredential('cred-income-anchor-payroll')).toBeNull();
  });

  it('getProfileSummary reflects zero active credentials', async () => {
    const summary = await source('empty').getProfileSummary();
    expect(summary.activeCredentialsCount).toBe(0);
    expect(summary.riskCategory).toBe('High');
  });
});

describe('MockCredentialSource — error mode', () => {
  it('rejects on every method', async () => {
    const src = source('error');
    await expect(src.listCredentials()).rejects.toThrow(/Simulated network error/);
    await expect(src.getCredential('cred-income-anchor-payroll')).rejects.toThrow(
      /Simulated network error/
    );
    await expect(src.getProfileSummary()).rejects.toThrow(/Simulated network error/);
  });
});
