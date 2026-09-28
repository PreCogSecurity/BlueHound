import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DAYS_OF_WEEK,
    SCHEDULED_TASK_NAME,
    buildScheduleTaskArgs,
    validateScheduleParameters,
} from '../../utils/scheduledTask.ts';

const EXE = 'C:\\Program Files\\BlueHound\\BlueHound.exe';

test('builds a daily task', () => {
    const args = buildScheduleTaskArgs(
        { scheduleFrequency: 'DAILY', dayOfWeek: null, dayOfMonth: null, scheduleTime: '02:30' },
        EXE,
    );

    assert.deepEqual(args, [
        '/CREATE',
        '/F',
        '/SC',
        'DAILY',
        '/TN',
        SCHEDULED_TASK_NAME,
        '/TR',
        `"${EXE}" --collection-only`,
        '/ST',
        '02:30',
    ]);
});

test('builds a weekly task with an allow-listed day', () => {
    const args = buildScheduleTaskArgs(
        { scheduleFrequency: 'WEEKLY', dayOfWeek: 'SUN', dayOfMonth: null, scheduleTime: '23:00' },
        EXE,
    );

    assert.ok(args);
    assert.equal(args[args.indexOf('/D') + 1], 'SUN');
    assert.equal(args[args.indexOf('/SC') + 1], 'WEEKLY');
});

test('builds a monthly task with an allow-listed day of month', () => {
    const args = buildScheduleTaskArgs(
        { scheduleFrequency: 'MONTHLY', dayOfWeek: null, dayOfMonth: 15, scheduleTime: '03:00' },
        EXE,
    );

    assert.ok(args);
    assert.equal(args[args.indexOf('/D') + 1], '15');
});

test('rejects a command-injection payload in the time field', () => {
    // With the old shell string this reached cmd.exe as `& calc.exe`.
    for (const scheduleTime of ['02:30 & calc.exe', '02:30\ncalc', '2:30', '99:99', '02:30;whoami', '']) {
        const args = buildScheduleTaskArgs(
            { scheduleFrequency: 'DAILY', dayOfWeek: null, dayOfMonth: null, scheduleTime },
            EXE,
        );
        assert.equal(args, null, `expected ${JSON.stringify(scheduleTime)} to be rejected`);
    }
});

test('rejects a command-injection payload in the frequency field', () => {
    for (const scheduleFrequency of ['DAILY & calc.exe', 'daily', 'HOURLY', '', 1, null, undefined]) {
        const args = buildScheduleTaskArgs(
            { scheduleFrequency, dayOfWeek: null, dayOfMonth: null, scheduleTime: '02:30' },
            EXE,
        );
        assert.equal(args, null, `expected ${JSON.stringify(scheduleFrequency)} to be rejected`);
    }
});

test('rejects a command-injection payload in the day-of-week field', () => {
    for (const dayOfWeek of ['SUN & calc.exe', 'sunday', '', 3, null]) {
        const args = buildScheduleTaskArgs(
            { scheduleFrequency: 'WEEKLY', dayOfWeek, dayOfMonth: null, scheduleTime: '02:30' },
            EXE,
        );
        assert.equal(args, null, `expected ${JSON.stringify(dayOfWeek)} to be rejected`);
    }
});

test('rejects a command-injection payload in the day-of-month field', () => {
    for (const dayOfMonth of [0, 32, -1, 1.5, '1 & calc.exe', null, undefined, 'abc', {}]) {
        const args = buildScheduleTaskArgs(
            { scheduleFrequency: 'MONTHLY', dayOfWeek: null, dayOfMonth, scheduleTime: '02:30' },
            EXE,
        );
        assert.equal(args, null, `expected ${JSON.stringify(dayOfMonth)} to be rejected`);
    }
});

test('rejects a missing or unusable executable path', () => {
    for (const exe of ['', '   ', null, undefined, 42]) {
        const args = buildScheduleTaskArgs(
            { scheduleFrequency: 'DAILY', dayOfWeek: null, dayOfMonth: null, scheduleTime: '02:30' },
            exe as any,
        );
        assert.equal(args, null);
    }
});

test('rejects completely missing parameters', () => {
    assert.equal(buildScheduleTaskArgs(undefined as any, EXE), null);
    assert.equal(validateScheduleParameters(undefined as any), null);
});

test('never returns an argument that could be re-parsed by a shell', () => {
    const args = buildScheduleTaskArgs(
        { scheduleFrequency: 'WEEKLY', dayOfWeek: 'MON', dayOfMonth: null, scheduleTime: '01:05' },
        EXE,
    );
    assert.ok(args);
    // Every element must be a discrete token: no embedded switch separators.
    for (const arg of args) {
        assert.ok(!/[\r\n]/.test(arg));
    }
    assert.equal(args.length, 12);
});

test('exposes the allow-lists it validates against', () => {
    assert.deepEqual([...DAYS_OF_WEEK], ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    assert.equal(SCHEDULED_TASK_NAME, 'BlueHound Collection');
});
