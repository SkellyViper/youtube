# Sources: sample 08-media assets

Fetched 2026-11-04 for the Style Lab sample `08-media` (`src/scenes/style-lab/08-media/`). Both assets are in the public domain and may ship in demos.

## eniac-us-army-c1947.jpg (landscape still, 1340 x 1024)

- Source page: https://commons.wikimedia.org/wiki/File:Eniac.jpg
- File URL: https://upload.wikimedia.org/wikipedia/commons/d/d3/Glen_Beck_and_Betty_Snyder_program_the_ENIAC_in_building_328_at_the_Ballistic_Research_Laboratory.jpg
- Subject: Glen Beck (background) and Betty Snyder (foreground) programming the ENIAC in building 328 at the Ballistic Research Laboratory, Philadelphia, c. 1947 to 1955.
- Author / credit: U.S. Army Photo (author unknown).
- Licence: Public domain (work of the United States Army; pre-1978 US government photograph).
- What we did: downloaded via `Special:FilePath/Eniac.jpg?width=1920` (Commons served the 1340 x 1024 original as it is smaller than the request), renamed, otherwise unmodified.
- On-screen caption: "ENIAC, c. 1947. US Army photo".

## earth-night-iss-nasa-portrait.mp4 (portrait clip, 608 x 1080, 6.0 s, 30 fps, no audio, 2.4 MB)

- Source page: https://commons.wikimedia.org/wiki/File:Ocean_Moon_Glint_and_City_Night_Lights_in_4K.webm
- File URL: https://upload.wikimedia.org/wikipedia/commons/b/b9/Ocean_Moon_Glint_and_City_Night_Lights_in_4K.webm (1920 x 1080 VP9 transcode of NASA's 4K original)
- Subject: time-lapse taken by NASA astronaut Jack Fischer from the International Space Station in 2017, passing over the Pacific moon glint and the night lights of California through Colorado.
- Author / credit: NASA (NASA Ultra High Definition video gallery, https://www.nasa.gov/content/ultra-high-definition-video-gallery; also https://www.youtube.com/watch?v=8HW9gYGMiwo). Uploaded to Commons 2017-08-03.
- Licence: Public domain (NASA material is not protected by copyright unless noted; nothing noted on this item).
- What we did (ffmpeg): took seconds 7.0 to 13.0 of the 1080p file (the pass over the city lights), cropped a 608 x 1080 portrait window at x = 420 (the coast and city lights stay in frame), re-timed to exactly 30 fps / 180 frames, encoded as H.264 High profile, yuv420p, BT.709 tags, `-crf 18 -preset slow`, keyframe every 15 frames (`-g 15 -keyint_min 15 -sc_threshold 0`, so a keyframe every 0.5 s for cheap seeking), audio dropped (`-an`), `-movflags +faststart`. Command:

  ```
  ffmpeg -ss 7.0 -i "Ocean Moon Glint and City Night Lights in 4K.webm" -t 6.2 \
    -vf "crop=608:1080:420:0,setpts=N/30/TB" -r 30 -frames:v 180 \
    -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
    -g 15 -keyint_min 15 -sc_threshold 0 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -an -movflags +faststart earth-night-iss-nasa-portrait.mp4
  ```

- On-screen caption: "City lights from orbit. NASA".

## style-lab-gallery-demo.mp4 (landscape clip, 1280 x 720, 6.0 s, 30 fps, no audio, 0.9 MB)

Made 2026-11-05 for the redesigned scene `09-media-insert` (`src/scenes/redesign/09-media-insert/`, via `MediaInsert`). It is a **demo asset**, not footage of an incident: a screen recording of this repository's own Style Lab gallery, made because the NASA clip above is missing from the checkout and this environment has no network access to re-fetch it.

- Subject: the gallery page of this project's dev server, `http://localhost:5173/style-lab`, on the `style-lab-redesign` branch as it was on 2026-11-05 (header "Style Lab", the "Episode scenes" cards S02 and S04 and the "Legacy experiments" row with their live thumbnails). The pointer sweeps across the cards (their hover brackets follow it), then the page scrolls down to the legacy row.
- How it was recorded: Playwright (`@playwright/test`, headless Chromium build 1243 at `/opt/pw-browsers/chromium`, software GL via SwiftShader), `browser.newContext({viewport: {width: 1280, height: 720}, recordVideo: {size: {width: 1280, height: 720}}})`, 13.0 s of VP9 WebM at 25 fps. Playwright's own ffmpeg build is not installed here, so `PLAYWRIGHT_BROWSERS_PATH` pointed at a scratch registry whose `ffmpeg-1013/ffmpeg-linux` is a symlink to the system ffmpeg 6.1.1. Nothing in the page was staged or edited.
- Author / credit: this project (its own UI and its own renders inside the thumbnails). No third-party material.
- Licence: same as the repository.
- What we did (ffmpeg): took seconds 2.5 to 8.5 of the recording (cards loaded, hover sweep, scroll), scaled to exactly 1280 x 720, re-timed to 30 fps / 180 frames, encoded as H.264 High profile, yuv420p, BT.709 tags, `-crf 20 -preset slow`, keyframe every 15 frames (`-g 15 -keyint_min 15 -sc_threshold 0`; 12 keyframes in the file), audio dropped (`-an`), `-movflags +faststart`. 944 180 bytes. Command:

  ```
  ffmpeg -ss 2.5 -i page@<id>.webm -t 6.2 \
    -vf "scale=1280:720:flags=lanczos,setpts=N/30/TB" -r 30 -frames:v 180 \
    -c:v libx264 -preset slow -crf 20 -profile:v high -pix_fmt yuv420p \
    -g 15 -keyint_min 15 -sc_threshold 0 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -an -movflags +faststart style-lab-gallery-demo.mp4
  ```

- On-screen caption: "Screen recording of this project's gallery (demo asset)" (no date line on screen: it would not fit the pair slot beside the photo).
- Replace it with real footage when a licensed clip can be fetched: keep the recipe, update `CLIP` in `MediaInsertScene.tsx` (src, aspect, duration, caption) and this entry.

## Notes for future assets

- Wikimedia rate-limits downloads (HTTP 429 with `retry-after: 600`) after a few requests from one IP, even with a descriptive User-Agent; download once and keep the original in a scratch folder.
- Clips for `MediaPanel` should follow the same recipe: H.264, yuv420p, no audio, `+faststart`, a keyframe at least every 0.5 s, about 720p-class, under about 4 MB.
