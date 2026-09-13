const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

// The file might be slightly messed up by previous patches, so let's carefully replace the sections.
// Find the exact strings to replace.

const myContestsEmptyState = `
      {/* 3. MY CONTESTS SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <span>MY CONTESTS</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your registered collegiate coding symposium challenges and active rounds.
            </p>
          </div>
        </div>
        {studentContests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center">
            <Trophy className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-xl font-black text-gray-900 mb-2">No contests available</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Your assigned contests will appear here when they are published.
            </p>
          </div>
        ) : (
          studentContests.map(c => {
            const r = rounds.find(rd => rd.id === c.currentRoundId) || activeRound;
            return (
              <div key={c.id} className="bg-white rounded-3xl border border-gray-200/80 hover:border-gray-300 transition-all p-6 sm:p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                        {c.computedStatus}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                      {c.title}
                    </h3>
                  </div>
                  <div className="self-start sm:self-auto">
                    {getAttemptBadge()}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Round</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                      {r?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Assigned Batch</span>
                    <span className="font-bold text-xs sm:text-sm text-indigo-700 block truncate">
                      {studentBatch?.name || 'Batch A'}
                    </span>
                  </div>
                  <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3.5">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Duration</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block">
                      {r?.durationMinutes || 0} Minutes
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Anti-Cheat Protected • 60s Preparation Required</span>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isCompleted || isTerminated ? (
                      <button
                        id="view-results-btn"
                        onClick={() => setResultsModalOpen(true)}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        View Result Breakdown
                      </button>
                    ) : null}
                    <button
                      id="main-contest-action-btn"
                      onClick={handleOpenContestFlow}
                      disabled={c.computedStatus === 'UPCOMING' || c.computedStatus === 'ENDED'}
                      className={\`px-6 py-3 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 \${
                        c.computedStatus === 'UPCOMING'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : c.computedStatus === 'ENDED'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : isTerminated
                          ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                          : isCompleted
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : isActive
                          ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse cursor-pointer'
                          : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      }\`}
                    >
                      <span>{c.computedStatus === 'UPCOMING' ? 'Upcoming' : c.computedStatus === 'ENDED' && !isCompleted && !isTerminated ? 'Ended' : getActionButtonText()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
`;

const upcomingEmptyState = `
      {/* 4. UPCOMING ROUNDS SECTION */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>UPCOMING ROUNDS & FINALS</span>
          </h2>
        </div>
        <div className="bg-white rounded-3xl border border-gray-200/80 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <Layers className="w-10 h-10 text-gray-300 mb-3" />
          <h3 className="text-lg font-black text-gray-900 mb-1">No upcoming contests</h3>
        </div>
      </section>
`;

const myContestsRegex = /\{\/\* 3\. MY CONTESTS SECTION \*\/\}.*?(?=\{\/\* 4\. UPCOMING ROUNDS SECTION \*\/\})/s;
code = code.replace(myContestsRegex, myContestsEmptyState + "\n      ");

const upcomingRegex = /\{\/\* 4\. UPCOMING ROUNDS SECTION \*\/\}.*?(?=\{\/\* 5\. STUDENT GUIDANCE \/ HELPFUL NOTES \*\/\})/s;
code = code.replace(upcomingRegex, upcomingEmptyState + "\n      ");

fs.writeFileSync('src/components/HomePortal.tsx', code);
