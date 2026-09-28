import test from 'node:test';
import assert from 'node:assert/strict';

import { getLogger, redactSecrets, redactUriCredentials, setLogLevel, REDACTED } from '../../utils/logger.ts';

/** Captures everything written to the console while `fn` runs. */
const captureConsole = (fn: () => void): string[] => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    try {
        fn();
    } finally {
        console.log = original;
    }
    return lines;
};

test.afterEach(() => setLogLevel('info'));

test('redacts a Neo4j password embedded in a connection URI', () => {
    assert.equal(
        redactUriCredentials('bolt://neo4j:SuperSecret123@db.corp.local:7687'),
        `bolt://neo4j:${REDACTED}@db.corp.local:7687`,
    );
    assert.equal(
        redactUriCredentials('neo4j+s://neo4j:p%40ss@h:7687'),
        `neo4j+s://neo4j:${REDACTED}@h:7687`,
    );
});

test('leaves a URI without credentials untouched', () => {
    assert.equal(redactUriCredentials('neo4j://db.corp.local:7687'), 'neo4j://db.corp.local:7687');
});

test('redacts secret-looking keys at any depth', () => {
    const actual = redactSecrets({
        connection: { url: 'localhost', username: 'neo4j', password: 'hunter2' },
        neo4jAuth: { pwd: 'hunter2', scheme: 'basic' },
        apiKey: 'abcdef',
        authorization: 'Bearer abcdef',
        secret: 'shh',
        credentials: ['a', 'b'],
        harmless: 'visible',
    }) as any;

    assert.equal(actual.connection.url, 'localhost');
    assert.equal(actual.connection.username, 'neo4j');
    assert.equal(actual.connection.password, REDACTED);
    // A key that names an auth bundle masks the whole object rather than
    // relying on every nested key happening to look secret.
    assert.equal(actual.neo4jAuth, REDACTED);
    assert.equal(actual.apiKey, REDACTED);
    assert.equal(actual.authorization, REDACTED);
    assert.equal(actual.secret, REDACTED);
    assert.equal(actual.credentials, REDACTED);
    assert.equal(actual.harmless, 'visible');
});

test('redacts secrets inside arrays', () => {
    const actual = redactSecrets({ results: [{ name: 'a', password: 'p1' }, { name: 'b', password: 'p2' }] }) as any;
    assert.equal(actual.results[0].name, 'a');
    assert.equal(actual.results[0].password, REDACTED);
    assert.equal(actual.results[1].password, REDACTED);
});

test('redacts secrets inside Error objects without losing the message', () => {
    const error = new Error('failed to connect to bolt://neo4j:hunter2@db:7687');
    const actual = redactSecrets({ error }) as any;

    assert.equal(actual.error.name, 'Error');
    assert.ok(!actual.error.message.includes('hunter2'));
    assert.ok(actual.error.message.includes('failed to connect'));
});

test('redaction survives circular structures', () => {
    const payload: any = { name: 'loop' };
    payload.self = payload;
    const actual = redactSecrets(payload) as any;

    assert.equal(actual.name, 'loop');
    assert.equal(actual.self, '[Circular]');
});

test('respects the configured log level', () => {
    setLogLevel('warn');
    const logger = getLogger('ingestion');

    const lines = captureConsole(() => {
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');
    });

    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes('warn message'));
    assert.ok(lines[1].includes('error message'));
});

test('prefixes every line with its level and scope', () => {
    const lines = captureConsole(() => getLogger('main').info('window created'));
    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith('[INFO] [main]'));
    assert.ok(lines[0].includes('window created'));
});

test('redacts metadata before it reaches the log buffer', () => {
    const lines = captureConsole(() =>
        getLogger('ingestion').error('upload failed', {
            connectionProperties: { url: 'localhost', username: 'neo4j', password: 'hunter2' },
        }),
    );

    assert.equal(lines.length, 1);
    assert.ok(!lines[0].includes('hunter2'));
    assert.ok(lines[0].includes(REDACTED));
});

test('redacts credentials in the message text itself', () => {
    const lines = captureConsole(() => getLogger('db').error('connect failed: neo4j://neo4j:hunter2@db:7687'));
    assert.ok(!lines[0].includes('hunter2'));
});

test('child loggers extend the scope', () => {
    const lines = captureConsole(() => getLogger('ingestion').child('sharphound').info('unzipping'));
    assert.ok(lines[0].startsWith('[INFO] [ingestion.sharphound]'));
});

test('silent level suppresses everything', () => {
    setLogLevel('silent');
    const lines = captureConsole(() => getLogger('ingestion').error('should not appear'));
    assert.equal(lines.length, 0);
});
