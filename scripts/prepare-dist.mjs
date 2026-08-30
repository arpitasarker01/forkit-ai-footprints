import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

fs.mkdirSync(new URL('../dist/assets/', import.meta.url), { recursive: true });
function prepareLogo(source, output) {
  const result = spawnSync('sips', ['--cropToHeightWidth', '1800', '1800', new URL(source, import.meta.url).pathname, '--out', new URL(output, import.meta.url).pathname], { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) throw new Error(`Official Forkit logo preparation failed: ${result.stderr}`);
}

prepareLogo('../Logo_Forkit/logo_Only/color_Dark/color_Dark.png', '../dist/assets/forkit-icon-light.png');

const { UI_COPY, uiText } = require('../dist/localization.js');
const packagedCopy = Object.fromEntries(Object.entries(UI_COPY).map(([locale, copy]) => [
  locale,
  Object.fromEntries(Object.keys(copy).map((key) => [key, uiText(locale, key)])),
]));
fs.writeFileSync(new URL('../dist/locales.json', import.meta.url), `${JSON.stringify(packagedCopy, null, 2)}\n`);
prepareLogo('../Logo_Forkit/logo_Only/color_Light/color_Light.png', '../dist/assets/forkit-icon-dark.png');

if (process.platform !== 'win32') {
  fs.chmodSync(new URL('../dist/cli.js', import.meta.url), 0o755);
}
