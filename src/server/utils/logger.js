const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Badge backgrounds
  infoBg: '\x1b[44m',      // Blue
  warnBg: '\x1b[43m',      // Yellow
  errorBg: '\x1b[41m',     // Red
  successBg: '\x1b[42m',   // Green
  debugBg: '\x1b[45m',     // Magenta
  
  // Badge text
  infoText: '\x1b[97m',    // Bright white
  warnText: '\x1b[30m',    // Black
  errorText: '\x1b[97m',   // Bright white
  successText: '\x1b[30m', // Black
  debugText: '\x1b[97m',   // Bright white
};

function getTime() {
  return new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

function formatBadge(type, bgColor, textColor) {
  const padded = type.toUpperCase().padStart(5).padEnd(5);
  return `${bgColor}${textColor}${colors.bold} ${padded} ${colors.reset}`;
}

const logger = {
  info(message) {
    const badge = formatBadge('INFO', colors.infoBg, colors.infoText);
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${message}`);
  },

  warn(message) {
    const badge = formatBadge('WARN', colors.warnBg, colors.warnText);
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${message}`);
  },

  error(message) {
    const badge = formatBadge('ERROR', colors.errorBg, colors.errorText);
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${message}`);
  },

  success(message) {
    const badge = formatBadge('OK', colors.successBg, colors.successText);
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${message}`);
  },

  debug(message) {
    const badge = formatBadge('DEBUG', colors.debugBg, colors.debugText);
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${message}`);
  },

  request(method, path, status) {
    const badge = formatBadge(method, colors.infoBg, colors.infoText);
    const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${badge} ${colors.gray}${getTime()}${colors.reset} ${colors.dim}→${colors.reset} ${path} ${statusColor}${status}${colors.reset}`);
  },

  startup(portOrMode, needsSetup = false) {
    console.log('');
    if (typeof portOrMode === 'number') {
      console.log(`${colors.infoBg}${colors.infoText}${colors.bold}  SODIUM  ${colors.reset} ${colors.dim}Server started${colors.reset}`);
      console.log(`${colors.gray}         ${colors.reset} ${colors.dim}→${colors.reset} http://localhost:${portOrMode}`);
      if (needsSetup) {
        console.log('');
        console.log(`${colors.warnBg}${colors.warnText}${colors.bold}  SETUP  ${colors.reset} ${colors.dim}Panel not configured${colors.reset}`);
        console.log(`${colors.gray}         ${colors.reset} ${colors.dim}→${colors.reset} Open http://localhost:${portOrMode}/setup to complete installation`);
      }
    } else {
      console.log(`${colors.infoBg}${colors.infoText}${colors.bold}  SODIUM  ${colors.reset} ${colors.dim}Bundler (${portOrMode})${colors.reset}`);
    }
    console.log('');
  }
};

export default logger;
