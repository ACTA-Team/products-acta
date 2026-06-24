import { CredentialDetailView } from '@/components/credentials/credential-detail-view';

export default async function CredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CredentialDetailView id={id} />;
}
