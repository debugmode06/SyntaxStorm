import fs from 'fs';
let content = fs.readFileSync('server/api_async.ts', 'utf-8');

content = content.replace(/import \{ db, hashPassword \} from '\.\/db\.ts';/, "import { hashPassword } from './db.ts';\nimport { db } from './proxy.ts';");

content = content.replace(/apiRouter\.patch\('\/settings\/anticheat', async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(\{[\s\S]*?\}\);\s*\}\);/g, `apiRouter.patch('/settings/anticheat', async (req: Request, res: Response) => {
  const updates = req.body;
  if (!updates) return res.status(400).json({ error: 'Missing updates payload' });
  const result = await db.updateContestSecuritySettings(updates);
  res.json({ success: true, ...result });
});`);

content = content.replace(/apiRouter\.get\('\/settings\/anticheat', async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(\{[\s\S]*?\}\);\s*\}\);/g, `apiRouter.get('/settings/anticheat', async (req: Request, res: Response) => {
  res.json(await db.getContestSecuritySettings());
});`);

fs.writeFileSync('server/api.ts', content);
console.log("Patched api.ts");
