import fs from 'node:fs';
import path from 'node:path';

class SessionLogger {
  constructor() {
    this.logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
      now.getHours()
    )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    this.sessionFileName = `session-${stamp}.log`;
    this.sessionFilePath = path.join(this.logsDir, this.sessionFileName);
    this.recentEntries = [];
    this.maxRecent = 16;
    this.listeners = new Set();

    const header = [
      '================================================================================',
      `Little Sun Gateway Session Log — Started ${now.toISOString()}`,
      'Privacy Policy: User prompts and model responses are strictly excluded from logs.',
      '================================================================================\n',
    ].join('\n');

    try {
      fs.writeFileSync(this.sessionFilePath, header, 'utf8');
    } catch {
      // ignore write error
    }
  }

  log(category, message) {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const isoStr = now.toISOString();
    const tag = String(category || 'SYS').toUpperCase().padEnd(4, ' ');
    const fileLine = `[${isoStr}] [${tag}] ${message}\n`;

    try {
      fs.appendFileSync(this.sessionFilePath, fileLine, 'utf8');
    } catch {
      // ignore
    }

    const entry = {
      time: timeStr,
      category: tag.trim(),
      message,
    };

    this.recentEntries.push(entry);
    if (this.recentEntries.length > this.maxRecent) {
      this.recentEntries.shift();
    }

    for (const fn of this.listeners) {
      try {
        fn(entry);
      } catch {
        // ignore
      }
    }
  }

  onUpdate(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const logger = new SessionLogger();
