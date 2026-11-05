import {defineConfig, devices} from '@playwright/test';

/**
 * Real-browser verification of the presentation app plus pure unit tests of
 * the timeline engine. `npm test` starts the Vite dev server if it is not
 * already running on :5173.
 */
export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {timeout: 15_000},
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: {width: 1920, height: 1080},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 1920, height: 1080},
        deviceScaleFactor: 1,
        // The Style Lab's 3D samples need WebGL; use the GPU through ANGLE when there is one.
        launchOptions: {args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']},
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
