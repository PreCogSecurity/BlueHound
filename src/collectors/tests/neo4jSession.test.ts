import test from 'node:test';
import assert from 'node:assert/strict';

import { IngestionError, runCypherStatement, runCypherStatements } from '../neo4jSession.ts';

/** Minimal stand-in for the neo4j driver session. */
const makeSession = (behaviour: (statement: string, params: unknown) => Promise<unknown>) => {
    const calls: Array<{ statement: string; params: unknown }> = [];
    return {
        calls,
        run: async (statement: string, params: unknown) => {
            calls.push({ statement, params });
            return behaviour(statement, params);
        },
    };
};

const makeLog = () => {
    const entries: Array<{ level: string; message: string; meta: any }> = [];
    const record = (level: string) => (message: string, meta?: unknown) => entries.push({ level, message, meta });
    return {
        entries,
        debug: record('debug'),
        info: record('info'),
        warn: record('warn'),
        error: record('error'),
    };
};

test('a successful statement is written and nothing is logged as an error', async () => {
    const session = makeSession(async () => ({ records: [] }));
    const log = makeLog();

    await runCypherStatement(session, 'UNWIND $props AS p MERGE (n) SET n.x = p.x', { props: [] }, log);

    assert.equal(session.calls.length, 1);
    assert.equal(log.entries.filter((entry) => entry.level === 'error').length, 0);
});

test('a rejected statement is logged and re-thrown, not swallowed', async () => {
    const boom = new Error('Neo.ClientError.Schema.ConstraintValidationFailed');
    const session = makeSession(async () => {
        throw boom;
    });
    const log = makeLog();

    await assert.rejects(
        () => runCypherStatement(session, 'CREATE (n:User {id: $id})', { id: 1 }, log),
        /ConstraintValidationFailed/,
    );

    const errors = log.entries.filter((entry) => entry.level === 'error');
    assert.equal(errors.length, 1);
    // The statement is logged so the failed write can be reproduced by hand.
    assert.ok(errors[0].meta.statement.includes('CREATE (n:User'));
    assert.equal(errors[0].meta.error, boom);
});

test('a non-Error rejection is still surfaced as an Error', async () => {
    const session = makeSession(async () => {
        throw 'string failure';
    });
    const log = makeLog();

    await assert.rejects(
        () => runCypherStatement(session, 'RETURN 1', null, log),
        (error: Error) => error instanceof Error && error.message === 'string failure',
    );
});

test('runCypherStatements reports how many statements were written', async () => {
    const session = makeSession(async () => ({ records: [] }));
    const log = makeLog();

    const written = await runCypherStatements(
        session,
        [
            { statement: 'RETURN 1', params: null },
            { statement: 'RETURN 2', params: null },
        ],
        log,
    );

    assert.equal(written, 2);
    assert.equal(session.calls.length, 2);
});

test('runCypherStatements keeps going after a failure and then reports it', async () => {
    // A single bad batch must not hide the fact that the other batches landed,
    // and it must not hide the failure either.
    const session = makeSession(async (statement) => {
        if (statement === 'BAD') {
            throw new Error('syntax error');
        }
        return { records: [] };
    });
    const log = makeLog();

    await assert.rejects(
        () =>
            runCypherStatements(
                session,
                [
                    { statement: 'GOOD 1', params: null },
                    { statement: 'BAD', params: null },
                    { statement: 'GOOD 2', params: null },
                ],
                log,
            ),
        (error: IngestionError) => {
            assert.ok(error instanceof IngestionError);
            assert.equal(error.failures.length, 1);
            assert.equal(error.failures[0].statement, 'BAD');
            assert.match(error.message, /1 statement\(s\) failed/);
            return true;
        },
    );

    // Every statement was attempted, not just the ones before the failure.
    assert.deepEqual(session.calls.map((call) => call.statement), ['GOOD 1', 'BAD', 'GOOD 2']);
});

test('a fully successful batch does not throw', async () => {
    const session = makeSession(async () => ({ records: [] }));
    const log = makeLog();
    await assert.doesNotReject(() => runCypherStatements(session, [], log));
});
