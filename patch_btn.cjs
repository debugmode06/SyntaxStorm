const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

code = code.replace(
  /id="hero-view-contests-btn"\s*onClick=\{handleOpenContestFlow\}\s*className="px-5 py-2\.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"/,
  `id="hero-view-contests-btn"
                onClick={handleOpenContestFlow}
                disabled={studentContests.length === 0}
                className={\`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 \${studentContests.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}\`}`
);

// We should also replace the right card "View Details" button
code = code.replace(
  /onClick=\{handleOpenContestFlow\}\s*className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"/,
  `onClick={handleOpenContestFlow}
                disabled={studentContests.length === 0}
                className={\`font-bold flex items-center gap-1 \${studentContests.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700 cursor-pointer'}\`}`
);

fs.writeFileSync('src/components/HomePortal.tsx', code);
