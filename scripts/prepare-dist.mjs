import fs from 'node:fs';

fs.mkdirSync(new URL('../dist/assets/', import.meta.url), { recursive: true });
fs.copyFileSync(
  new URL('../Logo_Forkit/logo_Only/color_Dark/color_Dark.png', import.meta.url),
  new URL('../dist/assets/forkit-icon-light.png', import.meta.url),
);
fs.copyFileSync(
  new URL('../Logo_Forkit/logo_Only/color_Light/color_Light.png', import.meta.url),
  new URL('../dist/assets/forkit-icon-dark.png', import.meta.url),
);

if (process.platform !== 'win32') {
  fs.chmodSync(new URL('../dist/cli.js', import.meta.url), 0o755);
}
