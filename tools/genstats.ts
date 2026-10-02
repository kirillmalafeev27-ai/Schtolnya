import { levels } from '../src/config/levels';
import { generateLevel } from '../src/core/levelGen';
for (const def of levels) {
  for (const land of [false, true]) {
    let relaxed = 0, attempts = 0; const reasons: Record<string, number> = {};
    const N = 150;
    for (let s = 1; s <= N; s++) {
      const l = generateLevel(def, land, s * 31 + 7);
      if (l.relaxed) { relaxed++; const m = l.warnings[0].match(/\((\{.*\})\)/); if (m) { const o = JSON.parse(m[1]); for (const k in o) reasons[k] = (reasons[k]||0)+o[k]; } }
      attempts += l.attempts;
    }
    console.log(`L${def.id} ${land?'land':'port'} relaxed ${(relaxed/N*100).toFixed(1)}% avgAttempts ${(attempts/N).toFixed(1)}`, JSON.stringify(reasons));
  }
}
