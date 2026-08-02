import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Only files that opt into jsdom have a DOM to tear down; logic tests run in node.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
