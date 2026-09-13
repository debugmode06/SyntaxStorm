const fs = require('fs');
let code = fs.readFileSync('src/components/HomePortal.tsx', 'utf8');

code = code.replace(/} catch \(err: any\) \{[\s\S]*?console\.warn\('API start attempt warning:', err\);[\s\S]*?setPreparationModalOpen\(true\);\n    \}/g, `} catch (err: any) {
      console.error('Failed to start attempt:', err);
      alert('Unable to start contest. Please try again.');
    }`);
fs.writeFileSync('src/components/HomePortal.tsx', code);
