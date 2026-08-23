export const PRODUCT_NAME = 'forkit-ai-footprints' as const;
import packageMetadata from '../package.json';

// package.json is the only product-version source. npm, the CLI, native
// bundles, GitHub release tags, and package-manager metadata must derive from it.
export const PRODUCT_VERSION = packageMetadata.version;
export const SCHEMA_VERSION = '1.3' as const;
