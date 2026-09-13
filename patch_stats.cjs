const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

const attemptRegex = /<p className="text-2xl font-black text-gray-900">\s*\{isCompleted \? 'Finished' : isTerminated \? 'Locked' : isActive \? 'Active' : 'Ready'\}\s*<\/p>\s*<span className="text-\[11px\] text-emerald-600 font-medium mt-0\.5 block">\s*\{isCompleted \? 'Submissions Evaluated' : '1 Attempt Allowed'\}\s*<\/span>/s;

const newAttemptStats = `<p className="text-2xl font-black text-gray-900">
            {studentContests.length === 0 ? 'N/A' : (isCompleted ? 'Finished' : isTerminated ? 'Locked' : isActive ? 'Active' : 'Ready')}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            {studentContests.length === 0 ? 'No active contest' : (isCompleted ? 'Submissions Evaluated' : '1 Attempt Allowed')}
          </span>`;

code = code.replace(attemptRegex, newAttemptStats);

fs.writeFileSync('src/components/HomePortal.tsx', code);
