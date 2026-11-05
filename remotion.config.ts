// Remotion CLI / Studio configuration.
// The Node render script (scripts/render.mjs) mirrors these options so that
// `npm run render`, `npx remotion render` and the Studio render button agree.
import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/remotion/index.ts');
Config.setVideoImageFormat('png'); // lossless intermediate frames -> sharp type
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setX264Preset('slow');
Config.setOverwriteOutput(true);
// WebGL (the Style Lab's 3D samples) needs a real GL backend in headless Chrome.
Config.setChromiumOpenGlRenderer('angle');
