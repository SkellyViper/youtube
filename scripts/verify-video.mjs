// Inspect a rendered video with ffprobe/ffmpeg and check it against expectations.
//   node scripts/verify-video.mjs out/demo.mp4 [--width=1920 --height=1080 --fps=60 --frames=N]
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';

export const probe = (file) => {
  const json = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
      'stream=codec_name,profile,width,height,r_frame_rate,avg_frame_rate,pix_fmt,nb_read_frames,color_space,color_primaries,color_transfer:format=duration,size,bit_rate',
      '-of', 'json', file],
    {encoding: 'utf8'},
  );
  return JSON.parse(json);
};

export const verifyVideo = async (file, expected = {}) => {
  if (!fs.existsSync(file)) {
    console.error(`[verify] ✗ ${file} does not exist`);
    return false;
  }
  const info = probe(file);
  const s = info.streams[0];
  const [num, den] = s.r_frame_rate.split('/').map(Number);
  const fps = num / den;
  const frames = Number(s.nb_read_frames);
  const duration = Number(info.format.duration);

  // Full decode pass: any corrupt packet makes ffmpeg print errors.
  let decodeErrors = '';
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) {
    decodeErrors = String(e.stderr || e.message);
  }

  const checks = [
    ['container exists', true, `${(Number(info.format.size) / 1e6).toFixed(2)} MB`],
    ['codec is H.264', s.codec_name === 'h264', `${s.codec_name} (${s.profile})`],
    ['pixel format yuv420p', s.pix_fmt === 'yuv420p', s.pix_fmt],
    ['width', expected.width ? s.width === expected.width : true, `${s.width}`],
    ['height', expected.height ? s.height === expected.height : true, `${s.height}`],
    ['frame rate', expected.fps ? Math.abs(fps - expected.fps) < 0.01 : true, `${fps}`],
    ['frame count', expected.frames ? frames === expected.frames : true, `${frames}${expected.frames ? ` (expected ${expected.frames})` : ''}`],
    ['duration', true, `${duration.toFixed(3)}s`],
    ['decodes without errors', decodeErrors.trim() === '', decodeErrors.trim().split('\n')[0] || 'clean'],
  ];
  let ok = true;
  for (const [name, pass, detail] of checks) {
    if (!pass) ok = false;
    console.log(`[verify] ${pass ? '✓' : '✗'} ${name.padEnd(24)} ${detail}`);
  }
  console.log(`[verify] color: space=${s.color_space ?? '?'} primaries=${s.color_primaries ?? '?'} transfer=${s.color_transfer ?? '?'}; bitrate ${(Number(info.format.bit_rate) / 1e6).toFixed(1)} Mb/s`);
  console.log(ok ? '[verify] PASS' : '[verify] FAIL');
  return ok;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) ?? 'out/demo.mp4';
  const num = (name, fallback) => {
    const v = args.find((a) => a.startsWith(`--${name}=`));
    return v ? Number(v.split('=')[1]) : fallback;
  };
  const ok = await verifyVideo(file, {width: num('width', 1920), height: num('height', 1080), fps: num('fps', 60), frames: num('frames', undefined)});
  process.exit(ok ? 0 : 1);
}
