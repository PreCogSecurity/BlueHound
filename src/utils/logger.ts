/**
 * Minimal, dependency-free structured logger.
 *
 * BlueHound writes its diagnostics to `console`, which the Electron main
 * process captures (`webContents.on('console-message')`) and surfaces in the
 * About dialog. That is useful, but raw `console.log(err)` calls are how the
 * ingestion pipeline used to swallow failures: an operator saw "Upload done"
 * while the database was silently missing most of the graph.
 *
 * This logger gives every subsystem a named scope, a level that can be raised
 * at runtime for support bundles, and - most importantly - redacts secrets
 * before anything reaches the console buffer that gets attached to bug
 * reports.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

/**
 * Object keys whose values must never be written to the log buffer.
 * BlueHound holds a Neo4j password in renderer state, and it can end up inside
 * error objects, connection-property bags and collector arguments.
 */
const SECRET_KEY_PATTERN =
    /(pass(word|wd)?|secret|token|api[-_]?key|authorization|auth|credential|neo4j[-_]?auth)/i;

export const REDACTED = '[REDACTED]';

/**
 * Strips credentials out of a `neo4j://user:password@host` style URI, which is
 * how a connection error is most likely to leak the database password.
 */
export const redactUriCredentials = (value: string): string =>
    value.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]*)@/gi, `$1$2:${REDACTED}@`);

/**
 * Recursively redacts secrets from arbitrary log metadata. Cycles are handled
 * so a Neo4j driver error can never hang the logger.
 */
export const redactSecrets = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
    if (typeof value === 'string') {
        return redactUriCredentials(value);
    }
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (seen.has(value as object)) {
        return '[Circular]';
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
        return value.map((entry) => redactSecrets(entry, seen));
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactUriCredentials(value.message),
            stack: value.stack ? redactUriCredentials(value.stack) : undefined,
        };
    }

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        output[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(entry, seen);
    }
    return output;
};

export interface Logger {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    child(scope: string): Logger;
}

let minimumLevel: LogLevel = 'info';

/**
 * Raises or lowers the global threshold. `BLUEHOUND_LOG_LEVEL=debug` (or the
 * About dialog's log picker) can use this to capture a verbose support bundle.
 */
export const setLogLevel = (level: LogLevel): void => {
    if (level in LEVEL_ORDER) {
        minimumLevel = level;
    }
};

export const getLogLevel = (): LogLevel => minimumLevel;

const write = (scope: string, level: Exclude<LogLevel, 'silent'>, message: string, meta?: unknown) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) {
        return;
    }
    const prefix = `[${level.toUpperCase()}] [${scope}]`;
    // Metadata is always redacted: an Error carries the message, the stack and
    // whatever the driver attached, and any of those can hold a password.
    const safeMessage = redactUriCredentials(String(message));
    if (meta === undefined) {
        console.log(`${prefix} ${safeMessage}`);
        return;
    }
    console.log(`${prefix} ${safeMessage}`, redactSecrets(meta));
};

/**
 * Returns a logger bound to a subsystem name, e.g. `getLogger('ingestion')`.
 */
export const getLogger = (scope: string): Logger => ({
    debug: (message, meta) => write(scope, 'debug', message, meta),
    info: (message, meta) => write(scope, 'info', message, meta),
    warn: (message, meta) => write(scope, 'warn', message, meta),
    error: (message, meta) => write(scope, 'error', message, meta),
    child: (childScope) => getLogger(`${scope}.${childScope}`),
});

export default getLogger;
