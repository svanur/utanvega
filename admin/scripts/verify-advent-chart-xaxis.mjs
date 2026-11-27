#!/usr/bin/env node
/**
 * Render-verification script for #1913.
 *
 * AdventEntriesPage.tsx's 24-day bar chart (admin/src/pages/AdventEntriesPage.tsx:233-248) had
 * its XAxis label density at 375px/320px checked ad hoc with a throwaway Playwright script
 * during the #1901 / PR #1911 cycle — the finding (recharts v3's default tick-thinning avoids
 * overlap; see the code comment at AdventEntriesPage.tsx:~230) was never reproducible because
 * that script was never committed. This file is the committed, re-runnable replacement.
 *
 * jsdom (used by AdventEntriesPage.test.tsx) has no layout engine, so it can't catch real tick
 * overlap — see that test file's ResizeObserver-stub comment. This script instead renders the
 * chart in a real Chromium instance via Playwright and measures actual tick <text> bounding
 * boxes.
 *
 * What it does:
 *   1. Starts the admin app's own Vite dev server (admin/vite.config.ts) in-process via Vite's
 *      `createServer` API, on an OS-assigned ephemeral port.
 *   2. Opens scripts/chart-harness.html in it — a small fixture that renders the same
 *      BarChart/XAxis configuration as AdventEntriesPage.tsx (see chart-harness.tsx for why a
 *      separate fixture is used instead of importing the real page).
 *   3. For each of the two widths the #1901 finding covers (375px, 320px), reads every
 *      <text> tick rendered under the XAxis tick group and checks that no two consecutive
 *      labels' bounding boxes overlap horizontally.
 *   4. Prints PASS/FAIL per width — including which day numbers recharts actually drew, so a
 *      future regression in tick-thinning (e.g. from a recharts upgrade) shows up as "all 24
 *      labels now shown" rather than just a bare failure — and exits 1 if any width overlaps.
 *
 * One-time setup (per machine/CI image only — the browser binary is cached under the user
 * profile, e.g. ~/AppData/Local/ms-playwright on Windows, ~/.cache/ms-playwright on Linux/Mac):
 *   cd admin && npx playwright install chromium
 *
 * Run:
 *   cd admin && npm run verify:chart-xaxis
 *   (equivalent to: node scripts/verify-advent-chart-xaxis.mjs)
 *
 * This is a local, manually-run check (see #1913 scope) — it is not wired into
 * .github/workflows/ci.yml and is not part of `npm test`, `npm run build`, or `npm run lint`.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminRoot = resolve(__dirname, '..');

const WIDTHS = [375, 320];
// recharts v3 renders tick labels in a separate z-index overlay layer, not nested under the
// `.recharts-xAxis` tick-line group (confirmed by inspecting the rendered DOM) — the x-axis
// labels' own wrapper group is `.recharts-xAxis-tick-labels`, which is what distinguishes them
// from the y-axis's `.recharts-yAxis-tick-labels` siblings.
const TICK_SELECTOR = '.recharts-xAxis-tick-labels text';

async function main() {
    const server = await createServer({
        root: adminRoot,
        configFile: resolve(adminRoot, 'vite.config.ts'),
        server: { port: 0, strictPort: false },
        logLevel: 'error',
    });
    await server.listen();

    const address = server.httpServer?.address();
    const port = typeof address === 'object' && address ? address.port : null;
    if (!port) throw new Error('Could not resolve the Vite dev server port');
    const url = `http://localhost:${port}/scripts/chart-harness.html`;

    const browser = await chromium.launch();
    let anyFailed = false;

    try {
        for (const width of WIDTHS) {
            const page = await browser.newPage({ viewport: { width, height: 400 } });
            await page.goto(url);
            await page.waitForSelector(TICK_SELECTOR);

            const ticks = await page.$$eval(TICK_SELECTOR, (nodes) =>
                nodes.map((node) => {
                    const rect = node.getBoundingClientRect();
                    return { label: node.textContent ?? '', left: rect.left, right: rect.right };
                }),
            );
            ticks.sort((a, b) => a.left - b.left);

            const overlapping = [];
            for (let i = 1; i < ticks.length; i++) {
                const prev = ticks[i - 1];
                const curr = ticks[i];
                if (curr.left < prev.right) {
                    overlapping.push(`${prev.label}/${curr.label}`);
                }
            }

            const shown = ticks.map((t) => t.label).join(',');
            if (overlapping.length > 0) {
                anyFailed = true;
                console.error(`FAIL ${width}px: overlapping label pairs [${overlapping.join(', ')}] (shown: ${shown})`);
            } else {
                console.log(`PASS ${width}px: ${ticks.length} labels shown, no overlap (shown: ${shown})`);
            }

            await page.close();
        }
    } finally {
        await browser.close();
        await server.close();
    }

    if (anyFailed) {
        console.error('\nXAxis label-density check FAILED — see above.');
        process.exit(1);
    }
    console.log('\nXAxis label-density check PASSED at all widths.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
