const base = process.env.LHCI_BASE_URL ?? 'http://127.0.0.1:3101';

module.exports = {
  ci: {
    collect: {
      startServerCommand: process.env.LHCI_BASE_URL ? undefined : 'npm run serve:lhci',
      startServerReadyPattern: 'Ready|Local:',
      startServerReadyTimeout: 120_000,
      url: [`${base}/`, `${base}/ranking`, `${base}/prensa`],
      numberOfRuns: 2,
      settings: { preset: 'desktop', chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.75 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.15 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-report' },
  },
};

