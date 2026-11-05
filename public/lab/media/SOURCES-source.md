# Sources for sample 07-source

Real captures, made by `node scripts/lab-capture.mjs` on 2026-11-04. Nothing in these images is mocked up or retouched; the text the viewer reads is the source's own text. Highlight regions are measured by the same script (DOM Range / pdf.js text runs) and stored in the `.json` next to each image.

| Asset | What it is | URL | Captured | Licence |
| --- | --- | --- | --- | --- |
| `source-morris-worm.png` (3000 x 1880, 737 KB) | Top of the English Wikipedia article "Morris worm". Chromium, 1500 x 940 CSS px viewport at device scale factor 2, default logged-out appearance (light, standard width). | https://en.wikipedia.org/wiki/Morris_worm (revision: https://en.wikipedia.org/w/index.php?oldid=1376534515) | 2026-11-04 | Article text: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0), Wikipedia contributors. The page also shows the Wikipedia wordmark / puzzle-globe logo, which are trademarks of the Wikimedia Foundation, and a thumbnail of the photo "Morris Worm.jpg" by Go Card USA (Boston), CC BY-SA 2.0, from Wikimedia Commons. Attribute as "Wikipedia, Morris worm, CC BY-SA 4.0". |
| `source-morris-worm.json` | Measurements for the image above, in image pixels: `passage` (one sentence of the lead, with per-line boxes), `paragraph`, `title`. | same | 2026-11-04 | n/a (data) |
| `source-nist-ai-rmf-p1.png` (1700 x 2200, 707 KB) | NIST AI 100-1, "Artificial Intelligence Risk Management Framework (AI RMF 1.0)", January 2023: the page numbered "Page 1" (Executive Summary; sixth page of the PDF), rasterised with pdf.js at 200 dpi. | https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf (https://doi.org/10.6028/NIST.AI.100-1) | 2026-11-04 | Public domain in the United States: a work of the US Government (National Institute of Standards and Technology), not subject to copyright protection under 17 U.S.C. 105. Credit NIST as the source. |
| `source-nist-ai-rmf-p1.json` | Measurements for the image above, in image pixels: `heading`. | same | 2026-11-04 | n/a (data) |

Notes

- The only thing hidden during the web capture is transient site notices (fundraising / central notice banners), via a `display: none` rule; the article itself is untouched.
- The timestamps inside the `.json` files are UTC (`capturedAt`) plus the local calendar date (`capturedOn`).
- To refresh or add captures, edit the `CAPTURES` list at the top of `scripts/lab-capture.mjs` and run it again. It also regenerates `src/scenes/style-lab/07-source/sources.generated.ts`, the typed copy the scene imports.
