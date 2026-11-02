import { logger } from './logger.mjs';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const AMBER = '\x1b[38;5;214m';
const GREEN = '\x1b[38;5;78m';
const RED = '\x1b[38;5;203m';
const CYAN = '\x1b[38;5;117m';
const GRAY = '\x1b[38;5;245m';

export class CliDashboard {
  constructor({ getState }) {
    this.getState = getState;
    this.timer = null;
    this.isInteractive = Boolean(process.stdout.isTTY);
  }

  start() {
    logger.onUpdate(() => {
      if (this.isInteractive) {
        this.render();
      }
    });

    if (this.isInteractive) {
      this.render();
      this.timer = setInterval(() => this.render(), 1000);
    } else {
      // Non-TTY fallback: print new logs as lines
      logger.onUpdate((entry) => {
        console.log(`[${entry.time}] [${entry.category}] ${entry.message}`);
      });
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  formatBadge(status) {
    if (status === 'ready' || status === 'online') {
      return `${GREEN}● ONLINE${RESET}`;
    }
    if (status === 'loading' || status === 'starting' || status === 'processing') {
      return `${AMBER}◐ ${status.toUpperCase()}${RESET}`;
    }
    if (status === 'unloaded' || status === 'sleeping') {
      return `${AMBER}○ SLEEPING (IDLE)${RESET}`;
    }
    return `${RED}✕ OFFLINE${RESET}`;
  }

  render() {
    if (!this.isInteractive) return;
    const state = this.getState();
    const cols = process.stdout.columns || 100;
    const ruleWidth = Math.min(76, Math.max(50, cols - 4));
    const rule = `${GRAY}${'━'.repeat(ruleWidth)}${RESET}`;

    const lines = [];
    // Set clean window title + clear screen + move cursor home
    lines.push('\x1b]0;Little Sun - Local AI Supervisor\x07\x1b[2J\x1b[3J\x1b[H');
    lines.push(
      `  ${AMBER}${BOLD}☀  LITTLE SUN - LOCAL AI GATEWAY & SERVICE SUPERVISOR${RESET}`
    );
    lines.push(`  ${rule}`);

    // Services Status Grid
    const gatewayStr = `${GREEN}● LISTENING${RESET} ${DIM}(http://127.0.0.1:${state.gatewayPort})${RESET}`;
    const funnelStr = state.funnelUrl
      ? `${GREEN}● ACTIVE${RESET}    ${CYAN}${state.funnelUrl}${RESET}`
      : `${AMBER}○ LOCAL${RESET}     ${DIM}(Run: tailscale funnel ${state.gatewayPort})${RESET}`;

    const ttsStr = `${this.formatBadge(state.ttsState)}  ${DIM}(${state.ttsUrl} · Auto-Supervised)${RESET}`;

    let llmDetail = `Port ${state.llamaPort}`;
    if (state.llm.modelId) {
      llmDetail += ` · Model: ${BOLD}${state.llm.modelName || state.llm.modelId}${RESET}`;
    }
    if (state.llm.idleSecondsLeft !== null) {
      llmDetail += ` · Auto-unload in ${AMBER}${state.llm.idleSecondsLeft}s${RESET}`;
    }
    const llmStr = `${this.formatBadge(state.llm.state)}  ${DIM}(${llmDetail})${RESET}`;

    lines.push(`  ${BOLD}Gateway Server :${RESET} ${gatewayStr}`);
    lines.push(`  ${BOLD}Public Funnel  :${RESET} ${funnelStr}`);
    lines.push(`  ${BOLD}Pocket TTS     :${RESET} ${ttsStr}`);
    lines.push(`  ${BOLD}Llama Engine   :${RESET} ${llmStr}`);
    lines.push(`  ${BOLD}Session Log    :${RESET} ${DIM}logs/${logger.sessionFileName} (Prompts/Replies excluded)${RESET}`);
    lines.push(`  ${rule}`);
    lines.push(`  ${BOLD}LIVE SYSTEM EVENTS${RESET} ${DIM}(Most recent ${logger.recentEntries.length} events)${RESET}`);
    lines.push('');

    const maxMsgLen = Math.max(40, cols - 22);

    if (logger.recentEntries.length === 0) {
      lines.push(`  ${DIM}Waiting for activity...${RESET}`);
    } else {
      for (const item of logger.recentEntries) {
        let tagColor = GRAY;
        if (item.category === 'LLM') tagColor = AMBER;
        else if (item.category === 'TTS') tagColor = CYAN;
        else if (item.category === 'NET') tagColor = GREEN;
        else if (item.category === 'ERR') tagColor = RED;

        const cleanMsg =
          item.message.length > maxMsgLen
            ? `${item.message.slice(0, maxMsgLen - 1)}…`
            : item.message;

        lines.push(
          `  ${DIM}${item.time}${RESET}  ${tagColor}[${item.category.padEnd(4, ' ')}]${RESET}  ${cleanMsg}`
        );
      }
    }

    lines.push('');
    lines.push(`  ${rule}`);
    lines.push(`  ${DIM}Press Ctrl+C to stop all supervised services cleanly.${RESET}`);

    process.stdout.write(lines.join('\n') + '\n');
  }
}
