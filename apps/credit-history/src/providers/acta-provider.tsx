'use client';

import { ActaConfig, mainNet, testNet } from '@acta-products/acta';
import type { baseURL } from '@acta-products/acta';
import type { StellarNetwork } from '@acta-products/acta/did';

// Next.js inlines NEXT_PUBLIC_* at build time — declare so TypeScript resolves.
declare const NEXT_PUBLIC_STELLAR_NETWORK: string | undefined;
declare const NEXT_PUBLIC_ACTA_API_KEY: string | undefined;

function resolveBaseURL(network: StellarNetwork): baseURL {
  return network === 'mainnet' ? mainNet : testNet;
}

function resolveNetwork(): StellarNetwork {
  const raw =
    typeof NEXT_PUBLIC_STELLAR_NETWORK !== 'undefined'
      ? (NEXT_PUBLIC_STELLAR_NETWORK as string)
      : 'testnet';
  return raw === 'mainnet' ? 'mainnet' : 'testnet';
}

interface ActaProviderProps {
  children: React.ReactNode;
}

export function ActaProvider({ children }: ActaProviderProps) {
  const network = resolveNetwork();
  const baseURL = resolveBaseURL(network);
  const apiKey =
    typeof NEXT_PUBLIC_ACTA_API_KEY !== 'undefined' &&
    (NEXT_PUBLIC_ACTA_API_KEY as string).length > 0
      ? (NEXT_PUBLIC_ACTA_API_KEY as string)
      : 'placeholder-batch1-no-api-calls';

  return (
    <ActaConfig baseURL={baseURL} apiKey={apiKey}>
      {children}
    </ActaConfig>
  );
}
