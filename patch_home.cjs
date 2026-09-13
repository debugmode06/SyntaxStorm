const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

// 1. Replace hardcoded welcome string
code = code.replace(
  /WELCOME, \{currentUser\?\.name\?\.toUpperCase\(\) \|\| 'CANDIDATE'\} 👋/,
  "WELCOME, {currentUser?.name?.toUpperCase() || 'STUDENT'}"
);

// 2. Replace hardcoded "NEXT CONTEST" card
code = code.replace(
  /<h3 className="font-extrabold text-sm text-gray-900 leading-tight">\s*\{contest\?\.title \|\| 'Apex Code Grand Prix 2026'\}\s*<\/h3>/g,
  `<h3 className="font-extrabold text-sm text-gray-900 leading-tight">
                {studentContests.length > 0 ? studentContests[0].title : 'No Contests Available'}
              </h3>`
);

code = code.replace(
  /<p className="text-xs text-gray-500 mt-0\.5">\s*\{activeRound\?\.name \|\| 'Round 1: Preliminary Qualifier'\}\s*<\/p>/g,
  `<p className="text-xs text-gray-500 mt-0.5">
                {studentContests.length > 0 && activeRound ? activeRound.name : 'Waiting for round publication'}
              </p>`
);

code = code.replace(
  /<span className="text-xs font-bold text-gray-700 flex items-center gap-1">\s*<Timer className="w-3\.5 h-3\.5 text-blue-600" \/>\s*<span>60 Minutes<\/span>\s*<\/span>/,
  `<span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-blue-600" />
                <span>{studentContests.length > 0 && activeRound ? activeRound.durationMinutes : 0} Minutes</span>
              </span>`
);

// 3. Quick Stats Row
code = code.replace(
  /<p className="text-2xl font-black text-gray-900">1<\/p>\s*<span className="text-\[11px\] text-gray-400 font-medium mt-0\.5 block">Inter-Collegiate Grand Prix<\/span>/,
  `<p className="text-2xl font-black text-gray-900">{studentContests.length}</p>
          <span className="text-[11px] text-gray-400 font-medium mt-0.5 block">{studentContests.length === 1 ? 'Available Contest' : 'Available Contests'}</span>`
);

code = code.replace(
  /<p className="text-2xl font-black text-gray-900">Top \{activeRound\?\.cutoffRank \|\| 15\}<\/p>/,
  `<p className="text-2xl font-black text-gray-900">{activeRound?.cutoffRank ? 'Top ' + activeRound.cutoffRank : 'N/A'}</p>`
);

code = code.replace(
  /<p className="text-2xl font-black text-gray-900">AST Guard<\/p>/,
  `<p className="text-2xl font-black text-gray-900">{studentContests.length > 0 ? 'Active Guard' : 'N/A'}</p>`
);

// 4. MY CONTESTS
code = code.replace(
  /All Contests \(1\)/,
  "All Contests ({studentContests.length})"
);

code = code.replace(
  /<span className="text-\[11px\] font-extrabold uppercase text-blue-700 bg-blue-50 px-2\.5 py-0\.5 rounded-md">\s*Inter-Collegiate Grand Prix\s*<\/span>\s*<span className="text-\[11px\] font-semibold text-gray-400">\s*Symposium Event #2026\s*<\/span>/,
  `<span className="text-[11px] font-extrabold uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                  {studentContests.length > 0 ? studentContests[0].status : 'N/A'}
                </span>
                <span className="text-[11px] font-semibold text-gray-400">
                  {studentContests.length > 0 ? 'CodeSymposium Event' : ''}
                </span>`
);

code = code.replace(
  /<h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">\s*\{contest\?\.title \|\| 'Apex Code Grand Prix 2026'\}\s*<\/h3>/g,
  `<h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {studentContests.length > 0 ? studentContests[0].title : 'No Contests Available'}
              </h3>`
);

code = code.replace(
  /\{activeRound\?\.name \|\| 'Round 1: Preliminary'}/,
  "{studentContests.length > 0 && activeRound ? activeRound.name : 'N/A'}"
);

code = code.replace(
  /\{activeRound\?\.durationMinutes \|\| 60\} Minutes/,
  "{studentContests.length > 0 && activeRound ? activeRound.durationMinutes : 0} Minutes"
);

// "Top {activeRound?.cutoffRank || 15} Qualify" -> "{activeRound?.cutoffRank ? 'Top ' + activeRound.cutoffRank + ' Qualify' : 'N/A'}"
code = code.replace(
  /Top \{activeRound\?\.cutoffRank \|\| 15\} Qualify/,
  "{activeRound?.cutoffRank ? 'Top ' + activeRound.cutoffRank + ' Qualify' : 'N/A'}"
);

fs.writeFileSync('src/components/HomePortal.tsx', code);
