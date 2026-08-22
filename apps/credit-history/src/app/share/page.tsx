'use client';

import * as React from 'react';
import { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Checkbox,
  Label,
  Input,
  CopyField,
  Badge,
  StatePanel,
} from '@acta-products/ui';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ShieldCheck,
  Calendar,
  Share2,
  ArrowLeft,
  RefreshCw,
  FileText,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import {
  createPresentationLink,
  PresentationLinkError,
  signPresentation,
} from '@/lib/presentation-link';
import { useSession } from '@/session/session-provider';
import { useCredentialSource } from '@/lib/use-credential-source';
import { getWalletConnector, resolveNetworkPassphrase } from '@/session/wallet-connector';

export default function SharePage() {
  const t = useTranslations('share');
  const tSession = useTranslations('session');
  const { address, did, connect } = useSession();
  const credentialSource = useCredentialSource();
  const format = useFormatter();
  const [credentials, setCredentials] = React.useState<CreditCredential[]>([]);
  const [profile, setProfile] = React.useState<CreditProfileSummary | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Expiration State
  // presets: '1h' | '1d' | '7d' | '30d' | 'never' | 'custom'
  const [expPreset, setExpPreset] = React.useState<'1h' | '1d' | '7d' | '30d' | 'never' | 'custom'>(
    '1d'
  );
  const [customExpDate, setCustomExpDate] = React.useState('');

  // Result state
  const [generatedLink, setGeneratedLink] = React.useState('');
  const [generatedExpirationTime, setGeneratedExpirationTime] = React.useState<number | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    // Nothing to fetch while disconnected — the render below shows the
    // connect prompt before ever looking at `loading` in that case.
    if (credentialSource.status !== 'ready') return;

    const loadData = async () => {
      try {
        const [creds, prof] = await Promise.all([
          credentialSource.source.listCredentials(),
          credentialSource.source.getProfileSummary(),
        ]);
        setCredentials(creds);
        setProfile(prof);
        // By default, select all valid credentials
        setSelectedIds(creds.filter((c) => c.status === 'valid').map((c) => c.id));
      } catch (err) {
        console.error('Failed to load credentials from mock source', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [credentialSource]);

  const handleToggleCredential = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === credentials.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(credentials.map((c) => c.id));
    }
  };

  const getExpirationTimestamp = (now: number): number | null => {
    switch (expPreset) {
      case '1h':
        return now + 60 * 60 * 1000;
      case '1d':
        return now + 24 * 60 * 60 * 1000;
      case '7d':
        return now + 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return now + 30 * 24 * 60 * 60 * 1000;
      case 'custom':
        return customExpDate ? new Date(customExpDate).getTime() : null;
      case 'never':
      default:
        return null;
    }
  };

  const handleGenerateLink = async () => {
    if (selectedIds.length === 0) {
      alert(t('noSelection'));
      return;
    }

    const holder = did ?? profile?.holderDid ?? '';
    if (!holder) {
      alert(t('noHolder'));
      return;
    }

    setIsGenerating(true);

    try {
      const createdAt = Date.now();
      const expirationTime = getExpirationTimestamp(createdAt);
      const input = {
        holder,
        credentialIds: selectedIds,
        expiresAt: expirationTime,
        createdAt,
      };

      // Holder proof over the presentation digest. Best-effort: a wallet that
      // declines to sign a bare digest must not block the share flow — the
      // opaque server-side reference is what makes the link tamper-evident.
      const proof =
        (await signPresentation(getWalletConnector(), input, {
          networkPassphrase: resolveNetworkPassphrase(),
          address: address ?? undefined,
        })) ?? undefined;

      const { url, expiresAt } = await createPresentationLink({ ...input, proof });

      setGeneratedExpirationTime(expiresAt);
      setGeneratedLink(url);
    } catch (err) {
      console.error('Failed to create the shareable presentation', err);
      alert(err instanceof PresentationLinkError ? err.message : t('generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setGeneratedLink('');
    setGeneratedExpirationTime(null);
    setSelectedIds(credentials.filter((c) => c.status === 'valid').map((c) => c.id));
    setExpPreset('1d');
    setCustomExpDate('');
  };

  if (credentialSource.status === 'disconnected') {
    return (
      <section className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-16">
        <StatePanel
          icon={<Wallet className="size-6" />}
          title={t('connect.title')}
          description={t('connect.description')}
          action={
            <Button
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => connect().catch(console.error)}
            >
              <Wallet className="size-3.5" />
              {tSession('connect')}
            </Button>
          }
        />
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[500px] gap-4">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">{t('loadingVault')}</p>
      </div>
    );
  }

  return (
    <section className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold tracking-wide uppercase">
            <ShieldCheck className="size-4" />
            {t('vaultTitle')}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl">{t('subtitle')}</p>
        </div>

        {generatedLink ? (
          /* Presentation Result Screen */
          <Card className="border-emerald-500/20 bg-emerald-500/[0.02] shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="text-center md:text-left">
              <div className="mx-auto md:mx-0 size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle2 className="size-6" />
              </div>
              <CardTitle className="text-2xl text-emerald-800 dark:text-emerald-400">
                {t('linkReady')}
              </CardTitle>
              <CardDescription className="text-base max-w-xl">{t('linkReadyDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="p-4 bg-background border border-border rounded-xl shadow-xs">
                <CopyField value={generatedLink} />
              </div>

              {/* Summary of what is shared */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t('sharedDetails')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
                    <span className="text-muted-foreground mb-1">{t('holder')}</span>
                    <span className="font-semibold">{profile?.holderName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                      {profile?.holderDid}
                    </span>
                  </div>
                  <div className="flex flex-col p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
                    <span className="text-muted-foreground mb-1">{t('expiration')}</span>
                    <span className="font-semibold break-words">
                      {generatedExpirationTime
                        ? format.dateTime(new Date(generatedExpirationTime), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('exp.never')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('includedCredentials', { count: selectedIds.length })}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {credentials
                      .filter((c) => selectedIds.includes(c.id))
                      .map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="px-2 py-0.5 bg-background text-[11px]"
                        >
                          {c.title}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row gap-3 border-t border-border/50 pt-6">
              <Button
                asChild
                variant="default"
                className="h-auto w-full whitespace-normal py-2.5 text-center text-sm md:w-auto cursor-pointer"
              >
                <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4 mr-2 shrink-0" />
                  {t('previewBtn')}
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="h-auto w-full whitespace-normal py-2.5 text-center text-sm md:w-auto cursor-pointer"
              >
                <ArrowLeft className="size-4 mr-2 shrink-0" />
                {t('backBtn')}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          /* Selection Screen */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Credentials Selection List */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-lg">{t('selectCredentials')}</CardTitle>
                    <CardDescription>{t('selectCredentialsDesc')}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold hover:bg-muted cursor-pointer"
                    onClick={handleSelectAll}
                  >
                    {selectedIds.length === credentials.length ? t('deselectAll') : t('selectAll')}
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-2">
                  {credentials.map((cred) => {
                    const isSelected = selectedIds.includes(cred.id);
                    const isRevoked = cred.status === 'revoked';

                    return (
                      <div
                        key={cred.id}
                        onClick={() => handleToggleCredential(cred.id)}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/[0.02]'
                            : 'border-border hover:border-border/80 hover:bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleCredential(cred.id)}
                          onClick={(e) => e.stopPropagation()} // Prevent double trigger
                          className="mt-1"
                        />
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-sm text-foreground truncate">
                              {cred.title}
                            </h3>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isRevoked ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  {t('revoked')}
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                  {t('valid')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {cred.description}
                          </p>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-2 font-mono">
                            <span>
                              {t('value')}{' '}
                              <strong className="text-foreground font-sans font-medium">
                                {cred.value}
                              </strong>
                            </span>
                            <span className="truncate">
                              {t('issuer')} {cred.issuer}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Expiration Configuration & Generate */}
            <div className="flex flex-col gap-4">
              <Card className="h-full flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    {t('expirationOptions')}
                  </CardTitle>
                  <CardDescription>{t('expirationOptionsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: '1h', label: t('exp.hour1') },
                      { key: '1d', label: t('exp.day1') },
                      { key: '7d', label: t('exp.days7') },
                      { key: '30d', label: t('exp.days30') },
                      { key: 'custom', label: t('exp.custom') },
                      { key: 'never', label: t('exp.never') },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setExpPreset(item.key as typeof expPreset)}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center whitespace-normal leading-snug transition-all cursor-pointer ${
                          expPreset === item.key
                            ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'border-border bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {expPreset === 'custom' && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label
                        htmlFor="custom-date"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {t('customDateLabel')}
                      </Label>
                      <Input
                        id="custom-date"
                        type="datetime-local"
                        value={customExpDate}
                        onChange={(e) => setCustomExpDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t border-border/50 pt-6">
                  <Button
                    onClick={() => void handleGenerateLink()}
                    disabled={selectedIds.length === 0 || isGenerating}
                    className="h-auto min-h-10 w-full whitespace-normal py-2.5 text-center text-sm font-semibold cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="size-4 animate-spin mr-2" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <Share2 className="size-4 mr-2" />
                        {t('generateBtn')}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
