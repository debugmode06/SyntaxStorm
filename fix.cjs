const fs = require('fs');
let c = fs.readFileSync('server/api.ts', 'utf8');
c = c.replace(/apiRouter\.get\('\/attempts\/me', async \(req: Request, res: Response\) => \{[\s\S]*?apiRouter\.post\(\['\/attempts\/start', '\/contests\/:contestId\/start'\], async \(req: Request, res: Response\) => \{/m, 
`apiRouter.get('/attempts/me', async (req: Request, res: Response) => {
  const user = resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeContest = db.getContest('active');
  const contestId = (req.query.contestId as string) || activeContest?.id || '';
  let attempt = contestId ? await db.getAttempt(contestId, user.id) : null;

  res.json({ attempt: attempt || null });
});

apiRouter.post(['/attempts/start', '/contests/:contestId/start'], async (req: Request, res: Response) => {`);
fs.writeFileSync('server/api.ts', c);
