import { PublicVerificationView } from '@/components/verify/public-verification-view';

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicVerificationView token={token} />;
}
