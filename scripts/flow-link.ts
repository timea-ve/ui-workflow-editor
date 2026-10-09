// `npm run flow -- flows/<file>.json [--local]`
// Checks a flow spec and prints a link that opens it as a new editable board.
// Default: the live app on GitHub Pages; --local: the dev server (npm run dev).
import { readFileSync } from 'node:fs';
import { parseFlowSpec } from '../src/platform/flowSpec.ts';
import { LIVE_APP_URL, LOCAL_APP_URL, encodeFlowSpec, flowLinkUrl } from '../src/platform/flowLink.ts';

const USAGE = 'Usage: npm run flow -- flows/<file>.json [--local]';
/** Links longer than this may get cut off by some chat apps and mail clients. */
const LONG_LINK = 8000;

async function main(argv: string[]): Promise<number> {
  const local = argv.includes('--local');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (files.length !== 1) {
    console.error(USAGE);
    return 2;
  }
  const file = files[0];
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    console.error(`Can't read ${file}. ${USAGE}`);
    return 2;
  }

  const result = parseFlowSpec(text);
  for (const w of result.warnings) console.error(`  ! ${w}`);
  if (!result.ok) {
    console.error(`\n✗ ${file} has ${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}:`);
    for (const e of result.errors) console.error(`  - ${e}`);
    return 1;
  }

  const { spec } = result;
  const screens = spec.lanes.reduce((n, l) => n + l.screens.length, 0);
  const decisions = spec.lanes.reduce((n, l) => n + l.decisions.length, 0);
  const options = spec.lanes.length > 1 ? `, ${spec.lanes.length} options` : '';
  const url = flowLinkUrl(local ? LOCAL_APP_URL : LIVE_APP_URL, await encodeFlowSpec(JSON.parse(text)));
  console.error(`✓ "${spec.name}": ${screens} screen${screens === 1 ? '' : 's'}, ${decisions} decision${decisions === 1 ? '' : 's'}${options} (${spec.device}).`);
  if (url.length > LONG_LINK) console.error(`  ! The link is long (${url.length} characters); some apps may cut it off. Fewer screens make it shorter.`);
  console.error('Open this link to get it as a new, editable board:');
  console.log(url);
  return 0;
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
