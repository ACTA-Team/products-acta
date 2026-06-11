/**
 * Shared types used across ACTA products. Keep this package free of runtime
 * code and external dependencies.
 */

/** Metadata describing a product hosted in this monorepo. */
export interface ProductMeta {
  /** Folder name under apps/ (e.g. "credit-history"). */
  slug: string;
  name: string;
  description: string;
}
