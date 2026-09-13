const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

code = code.replace(
  /<span className="text-\[11px\] text-gray-400 font-medium mt-0\.5 block">Advances to Round 2<\/span>/,
  `<span className="text-[11px] text-gray-400 font-medium mt-0.5 block">{activeRound?.cutoffRank ? 'Advances to Next Round' : 'No target set'}</span>`
);

code = code.replace(
  /<span className="text-\[11px\] text-indigo-600 font-medium mt-0\.5 block">Max 3 Tab Switches<\/span>/,
  `<span className="text-[11px] text-indigo-600 font-medium mt-0.5 block">{studentContests.length > 0 ? 'Max ' + (effectiveAttempt?.maxTabSwitches || 3) + ' Tab Switches' : 'No active guard'}</span>`
);

fs.writeFileSync('src/components/HomePortal.tsx', code);
