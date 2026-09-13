import fs from 'fs';
let content = fs.readFileSync('server/api.ts', 'utf-8');

// Add import bcrypt
content = content.replace(/import express from 'express';/, "import express from 'express';\nimport bcrypt from 'bcryptjs';");

// Replace require('bcryptjs').compareSync
content = content.replace(/require\('bcryptjs'\)\.compareSync/g, "bcrypt.compareSync");

fs.writeFileSync('server/api.ts', content);
