import fs from 'fs';
let content = fs.readFileSync('server/db.ts', 'utf-8');

// I will just use regex to remove everything between `class ContestDatabase {` and `  contest: Contest;`
content = content.replace(/class ContestDatabase \{[\s\S]*?contest: Contest;/, `class ContestDatabase {
  async getContestSecuritySettings() {
    return {
      settings: this.contest.settings,
      antiCheatConfig: this.contest.antiCheatConfig
    };
  }
  
  async updateContestSecuritySettings(updates: any) {
    if (!this.contest.antiCheatConfig) {
      this.contest.antiCheatConfig = { maxTabSwitches: 3, lockdownFullscreen: true, blockClipboardPaste: true, blockContextMenu: true, enablePlagiarismDetection: true, riskThreshold: 75 };
    }
    if (updates.maxTabSwitches !== undefined) this.contest.antiCheatConfig.maxTabSwitches = Number(updates.maxTabSwitches);
    if (updates.lockdownFullscreen !== undefined) this.contest.antiCheatConfig.lockdownFullscreen = !!updates.lockdownFullscreen;
    if (updates.blockClipboardPaste !== undefined) this.contest.antiCheatConfig.blockClipboardPaste = !!updates.blockClipboardPaste;
    if (updates.blockContextMenu !== undefined) this.contest.antiCheatConfig.blockContextMenu = !!updates.blockContextMenu;
    if (updates.enablePlagiarismDetection !== undefined) this.contest.antiCheatConfig.enablePlagiarismDetection = !!updates.enablePlagiarismDetection;
    
    this.logAudit('SECURITY_SETTINGS_UPDATED', this.currentUserId, 'Updated security policies');
    return this.getContestSecuritySettings();
  }

  contest: Contest;`);

fs.writeFileSync('server/db.ts', content);
