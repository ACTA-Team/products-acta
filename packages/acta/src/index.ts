/**
 * Thin integration layer over the official ACTA SDK.
 *
 * Products in this monorepo must consume ACTA exclusively through this
 * package. Do NOT import @acta-team/credentials directly from an app, and do
 * NOT add a dependency on did:stellar / @acta-team/did-stellar (unaudited,
 * explicitly out of scope).
 *
 * The SDK creates a React context at module scope, so this barrel can only be
 * imported from Client Components. Server Components needing only DID helpers
 * should import from '@acta-products/acta/did'.
 */
export * from '@acta-team/credentials';
export * from './did';
