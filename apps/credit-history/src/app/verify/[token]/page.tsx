'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { getCredentialSource } from '@acta-products/acta';
import { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from '@acta-products/ui';
import { t } from '../../../lib/i18n';
import {
  ShieldCheck,
  ShieldAlert,
  User,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function VerifyPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [expirationDate, setExpirationDate] = React.useState<Date | null>(null);

  const [sharedCredentials, setSharedCredentials] = React.useState<CreditCredential[]>([]);
  const [profile, setProfile] = React.useState<CreditProfileSummary | null>(null);

  // Accordion for showing claims data
  const [expandedCredId, setExpandedCredId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;

    const parseAndVerify = async () => {
      try {
        // 1. Decode base64url token
        let payload: { ids: string[]; exp: number | null } | null = null;
        try {
          const base64 = token
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .padEnd(token.length + ((4 - (token.length % 4)) % 4), '=');

          const jsonStr = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          payload = JSON.parse(jsonStr);
        } catch {
          setError(t('verify.error_desc'));
          setLoading(false);
          return;
        }

        if (!payload || !Array.isArray(payload.ids) || payload.ids.length === 0) {
          setError(t('verify.error_desc'));
          setLoading(false);
          return;
        }

        // 2. Check for expiration (app-level state)
        if (payload.exp) {
          const expDate = new Date(payload.exp);
          setExpirationDate(expDate);
          if (Date.now() > payload.exp) {
            setExpired(true);
            setLoading(false);
            return;
          }
        }

        // 3. Retrieve credentials from mock source
        const source = getCredentialSource();
        const [allCreds, prof] = await Promise.all([
          source.listCredentials(),
          source.getProfileSummary(),
        ]);

        const filtered = allCreds.filter((c) => payload!.ids.includes(c.id));

        if (filtered.length === 0) {
          setError(t('verify.error_desc'));
          setLoading(false);
          return;
        }

        setSharedCredentials(filtered);
        setProfile(prof);
      } catch (err) {
        console.error('Error in verification flow', err);
        setError(t('verify.error_desc'));
      } finally {
        setLoading(false);
      }
    };

    parseAndVerify();
  }, [token]);

  const toggleExpand = (id: string) => {
    setExpandedCredId((prev) => (prev === id ? null : id));
  };

  // Check if any shared credential is revoked
  const hasRevoked = sharedCredentials.some((c) => c.status === 'revoked');

  // Presentation State: 'valid' | 'revoked' | 'invalid' (expired or error)
  const presentationState: 'valid' | 'revoked' | 'invalid' =
    error || expired ? 'invalid' : hasRevoked ? 'revoked' : 'valid';

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen gap-4">
        <Clock className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Running cryptographic verification...
        </p>
      </div>
    );
  }

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-16">
      <div className="flex flex-col gap-8">
        {/* Verification Status Banner */}
        {presentationState === 'invalid' && (
          <Card className="border-destructive/20 bg-destructive/[0.02] shadow-md">
            <CardHeader className="text-center md:text-left flex flex-col md:flex-row items-center gap-4">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl text-destructive font-bold">
                  {t('verify.status.invalid')}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {expired
                    ? `${t('verify.status.invalid_desc')} (${t('verify.expired_at')}: ${expirationDate?.toLocaleString()})`
                    : error}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {presentationState === 'revoked' && (
          <Card className="border-amber-500/20 bg-amber-500/[0.02] shadow-md">
            <CardHeader className="text-center md:text-left flex flex-col md:flex-row items-center gap-4">
              <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl text-amber-700 dark:text-amber-400 font-bold">
                  {t('verify.status.revoked')}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {t('verify.status.revoked_desc')}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {presentationState === 'valid' && (
          <Card className="border-emerald-500/20 bg-emerald-500/[0.02] shadow-md">
            <CardHeader className="text-center md:text-left flex flex-col md:flex-row items-center gap-4">
              <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl text-emerald-800 dark:text-emerald-400 font-bold">
                  {t('verify.status.valid')}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {t('verify.status.valid_desc')}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {presentationState !== 'invalid' && (
          <>
            {/* Header & Meta */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/80 pb-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {t('verify.title')}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  {t('verify.subtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 shrink-0">
                <span>{t('verify.expiration')}:</span>
                <span className="font-semibold text-foreground">
                  {expirationDate ? expirationDate.toLocaleString() : t('verify.never_expires')}
                </span>
              </div>
            </div>

            {/* Holder Profile details */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  {t('verify.holder_info')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{t('verify.holder_name')}</span>
                    <span className="font-semibold text-sm">{profile?.holderName}</span>
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs text-muted-foreground">{t('verify.holder_did')}</span>
                    <span className="font-mono text-xs text-foreground truncate select-all">
                      {profile?.holderDid}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Included Credentials list */}
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold text-foreground px-1">
                {t('verify.credentials_included')} ({sharedCredentials.length})
              </h2>

              <div className="flex flex-col gap-4">
                {sharedCredentials.map((cred) => {
                  const isExpanded = expandedCredId === cred.id;
                  const isRevoked = cred.status === 'revoked';

                  return (
                    <Card
                      key={cred.id}
                      className={`transition-all duration-200 ${
                        isRevoked ? 'border-amber-500/20' : 'border-border'
                      }`}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-semibold">
                                {cred.title}
                              </CardTitle>
                              {isRevoked ? (
                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                  {t('verify.status.credential_revoked')}
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px] py-0 px-1.5">
                                  {t('verify.status.credential_valid')}
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-xs">
                              {cred.description}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-start md:items-end text-xs shrink-0">
                            <span className="text-muted-foreground">{t('verify.value')}</span>
                            <span className="text-base font-bold text-foreground">
                              {cred.value}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-muted/20 p-4 rounded-xl border border-border/40">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">{t('verify.issuer')}</span>
                            <span className="font-semibold">{cred.issuer}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">{t('verify.issue_date')}</span>
                            <span className="font-semibold">
                              {new Date(cred.issueDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 md:col-span-2">
                            <span className="text-muted-foreground">{t('verify.issuer_did')}</span>
                            <span className="font-mono text-[10px] truncate select-all">
                              {cred.issuerDid}
                            </span>
                          </div>
                        </div>

                        {/* Claims Accordion */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in duration-200">
                            <h4 className="text-xs font-semibold text-foreground mb-2">
                              {t('verify.claims_data')}
                            </h4>
                            <pre className="text-[10px] font-mono p-4 bg-muted/40 dark:bg-muted/10 border border-border rounded-lg overflow-x-auto text-muted-foreground select-all">
                              {JSON.stringify(cred.claims, null, 2)}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="border-t border-border/30 pt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => toggleExpand(cred.id)}
                          className="text-xs font-semibold cursor-pointer hover:bg-muted"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3.5 mr-1" />
                              {t('verify.hide_claims')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3.5 mr-1" />
                              {t('verify.view_claims')}
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Action Button at footer */}
        <div className="flex justify-center mt-4">
          <Button asChild variant="outline" className="cursor-pointer">
            <a href="/share">
              <ExternalLink className="size-4 mr-2" />
              {presentationState === 'invalid'
                ? t('verify.back_to_app')
                : 'Share a New Presentation'}
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
