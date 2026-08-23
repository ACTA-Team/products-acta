'use client';

import * as React from 'react';
import { getCredentialSource, getDataSourceMode, useActaClient } from '@acta-products/acta';
import type { CreditCredentialSource } from '@acta-products/acta/types';
import { useSession } from '@/session/session-provider';

export type CredentialSourceState =
  | { status: 'ready'; source: CreditCredentialSource }
  | { status: 'disconnected' };

/**
 * The single, documented way for the app to obtain a credential source wired
 * to the connected holder session — every surface that reads the holder's
 * own vault (list, detail, share) must go through this hook instead of
 * calling getCredentialSource directly with no arguments.
 *
 * useActaClient() is a hook and cannot be called from inside an async
 * effect, so session + client are read here, during render, and handed to
 * getCredentialSource together, in a single call.
 *
 * In mock mode the source is always 'ready' — no wallet required. In real
 * mode it reports 'disconnected' until a holder address is available, so
 * callers render the wallet-connect state instead of ever falling through
 * to mock fixtures.
 */
export function useCredentialSource(): CredentialSourceState {
  const { status, address, did } = useSession();
  const client = useActaClient();

  return React.useMemo(() => {
    if (getDataSourceMode() === 'real' && (status !== 'connected' || !address)) {
      return { status: 'disconnected' };
    }

    return {
      status: 'ready',
      source: getCredentialSource({
        owner: address ?? undefined,
        holderDid: did ?? undefined,
        client,
      }),
    };
  }, [status, address, did, client]);
}
