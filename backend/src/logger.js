const logs = [];

export function log(level, message, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  };

  logs.push(entry);

  if (logs.length > 100) {
    logs.shift();
  }

  console.log(JSON.stringify(entry));
}

export function getRecentLogs() {
  return logs.slice(-30);
}
