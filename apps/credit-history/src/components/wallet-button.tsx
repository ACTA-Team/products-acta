'use client';

/**
 * WalletButton — Client Component rendered inside the Server Component header.
 *
 * States:
 *   disconnected → "Connect wallet" button
 *   connecting   → disabled button with loading spinner + i18n label
 *   connected    → truncated G... address + truncated DID + "Disconnect" button
 *
 * All text via the 'session' i18n namespace. No hardcoded strings.
 */

import { useSession } from '@/session/session-provider';
import { useTranslations } from 'next-intl';
import { Button } from '@acta-products/ui';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

/** GABC...7KQ4 — shows first 4 and last 4 chars */
function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** did:pkh:stellar:testnet:GABC...7KQ4 — keeps prefix, truncates address */
function truncateDid(did: string): string {
  const parts = did.split(':');
  // did:pkh:stellar:{network}:{address}
  if (parts.length < 5) return did;
  const prefix = parts.slice(0, 4).join(':');
  const addr = parts[4];
  return `${prefix}:${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { status, address, did, connect, disconnect } = useSession();
  const t = useTranslations('session');

  if (status === 'disconnected') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => connect().catch(console.error)}
        className="gap-1.5"
      >
        <Wallet className="size-3.5" />
        {t('connect')}
      </Button>
    );
  }

  if (status === 'connecting') {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        {t('connecting')}
      </Button>
    );
  }

  // connected
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex flex-col items-end">
        <span className="text-xs font-medium text-foreground font-mono">
          {address ? truncateAddress(address) : ''}
        </span>
        <span
          className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]"
          title={did ?? ''}
        >
          {did ? truncateDid(did) : ''}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => disconnect().catch(console.error)}
        className="gap-1.5 text-muted-foreground hover:text-destructive"
        aria-label={t('disconnect')}
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">{t('disconnect')}</span>
      </Button>
    </div>
  );
}