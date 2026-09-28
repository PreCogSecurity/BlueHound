/**
 * Neo4j statement execution for the ingestion pipeline.
 *
 * The pipeline used to attach a `.catch(err => console.log(err))` to every
 * `session.run` call. That made a failed import indistinguishable from a
 * successful one: the analyst was told "Upload done", the graph was quietly
 * missing most of its hosts and edges, and every later attack-path report was
 * wrong because of it. A collection tool must fail loudly.
 *
 * The functions here log the statement and the error (with secrets redacted
 * by the logger) and then re-throw, and they aggregate failures so the caller
 * can tell the analyst exactly how much of their data did not land.
 */

export interface LoggerLike {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
}

export interface Neo4jSessionLike {
    run(statement: string, params?: unknown): Promise<unknown>;
    close?(): Promise<unknown> | unknown;
}

export interface StatementFailure {
    statement: string;
    error: Error;
}

/** Aggregates every failed statement so one bad batch cannot hide the rest. */
export class IngestionError extends Error {
    readonly failures: StatementFailure[];

    constructor(failures: StatementFailure[]) {
        const first = failures[0]?.error?.message ?? 'unknown error';
        super(`${failures.length} statement(s) failed while writing to Neo4j; first error: ${first}`);
        this.name = 'IngestionError';
        this.failures = failures;
    }
}

const asError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

/**
 * Runs a single Cypher statement, logging and re-throwing on failure.
 *
 * @param statement the Cypher text, logged so a failed import can be reproduced
 * @param params the parameter bag; the logger redacts anything password-shaped
 */
export const runCypherStatement = async (
    session: Neo4jSessionLike,
    statement: string,
    params: unknown,
    log: LoggerLike,
): Promise<void> => {
    try {
        await session.run(statement, params);
    } catch (error) {
        log.error('A Neo4j statement failed; the data in this batch was NOT written', { statement, error });
        throw asError(error);
    }
};

export interface StatementJob {
    statement: string;
    params: unknown;
}

/**
 * Runs a sequence of statements, collecting failures instead of stopping at
 * the first one, and throws an {@link IngestionError} if anything failed.
 *
 * Returns the number of statements that were written successfully so the
 * caller can report an accurate summary.
 */
export const runCypherStatements = async (
    session: Neo4jSessionLike,
    jobs: StatementJob[],
    log: LoggerLike,
): Promise<number> => {
    const failures: StatementFailure[] = [];
    let succeeded = 0;

    for (const job of jobs) {
        try {
            await runCypherStatement(session, job.statement, job.params, log);
            succeeded += 1;
        } catch (error) {
            failures.push({ statement: job.statement, error: asError(error) });
        }
    }

    if (failures.length > 0) {
        log.error('Some statements failed while writing to Neo4j', {
            failed: failures.length,
            total: jobs.length,
        });
        throw new IngestionError(failures);
    }
    return succeeded;
};
