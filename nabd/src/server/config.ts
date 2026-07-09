/* Centralized environment configuration — the only module that reads
   process.env. Every integration documents its variables here. */

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

export const config = {
  /** SQLite location; override with DATA_DIR for managed volumes. */
  dataDir: env("DATA_DIR") ?? "data",

  /** SMTP delivery for the email outbox (optional — outbox works without it). */
  smtp: {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") ?? 587),
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM"),
    get enabled() { return !!this.host; },
  },

  /** Microsoft Graph (Outlook) — mail scanning and calendar sync. */
  outlook: {
    tenantId: env("OUTLOOK_TENANT_ID"),
    clientId: env("OUTLOOK_CLIENT_ID"),
    clientSecret: env("OUTLOOK_CLIENT_SECRET"),
    get enabled() { return !!(this.tenantId && this.clientId && this.clientSecret); },
  },

  /** "debug" | "info" | "warn" | "error" — defaults to info. */
  logLevel: env("LOG_LEVEL") ?? "info",
} as const;
