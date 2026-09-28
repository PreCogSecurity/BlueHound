/**
 * Windows `schtasks` command construction.
 *
 * The "add scheduled task" flow in the collection modal used to build a single
 * shell string from renderer-supplied values and hand it to
 * `spawn(..., { shell: true })`. Every one of those values (frequency, day of
 * week/month, time) is attacker-influenced input, and `shell: true` means
 * cmd.exe metacharacters in them are executed with the operator's privileges -
 * a stored remote-code-execution primitive reachable through a shared or
 * imported BlueHound configuration.
 *
 * The fix is both safer and simpler: validate every parameter against a strict
 * allow-list, then return a fully discrete argv array so no shell is involved
 * and nothing can be re-parsed.
 */

export const SCHEDULE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const SCHEDULED_TASK_NAME = 'BlueHound Collection';

/** schtasks /ST takes a 24 hour HH:mm clock time. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ScheduleTaskParameters {
    scheduleFrequency: unknown;
    dayOfWeek: unknown;
    dayOfMonth: unknown;
    scheduleTime: unknown;
}

export interface ValidatedSchedule {
    frequency: ScheduleFrequency;
    time: string;
    dayOfWeek?: string;
    dayOfMonth?: number;
}

/**
 * Validates the scheduled-task parameters coming from the renderer.
 * Returns `null` instead of throwing so the IPC handler can report a clean,
 * user-facing error rather than crashing the main process.
 */
export const validateScheduleParameters = (parameters: ScheduleTaskParameters): ValidatedSchedule | null => {
    const { scheduleFrequency, dayOfWeek, dayOfMonth, scheduleTime } = parameters ?? ({} as ScheduleTaskParameters);

    if (typeof scheduleFrequency !== 'string' || !(SCHEDULE_FREQUENCIES as readonly string[]).includes(scheduleFrequency)) {
        return null;
    }
    const frequency = scheduleFrequency as ScheduleFrequency;

    if (typeof scheduleTime !== 'string' || !TIME_PATTERN.test(scheduleTime)) {
        return null;
    }

    const validated: ValidatedSchedule = { frequency, time: scheduleTime };

    if (frequency === 'WEEKLY') {
        if (typeof dayOfWeek !== 'string' || !(DAYS_OF_WEEK as readonly string[]).includes(dayOfWeek)) {
            return null;
        }
        validated.dayOfWeek = dayOfWeek;
    }

    if (frequency === 'MONTHLY') {
        // Strict numeric check: `parseInt('1 & calc.exe', 10)` returns 1, which
        // would smuggle a shell payload into the `/D` argument.
        const isNumericString = typeof dayOfMonth === 'string' && /^\d{1,2}$/.test(dayOfMonth.trim());
        const day = typeof dayOfMonth === 'number' ? dayOfMonth : isNumericString ? Number.parseInt(String(dayOfMonth), 10) : Number.NaN;
        if (!Number.isInteger(day) || day < 1 || day > 31) {
            return null;
        }
        validated.dayOfMonth = day;
    }

    return validated;
};

/**
 * Builds the argv for `SCHTASKS /CREATE`. `executablePath` is the absolute path
 * of the installed BlueHound binary; it is quoted because `/TR` takes a command
 * string and the path can contain spaces.
 *
 * Returns `null` when the parameters are not on the allow-list.
 */
export const buildScheduleTaskArgs = (parameters: ScheduleTaskParameters, executablePath: string): string[] | null => {
    const validated = validateScheduleParameters(parameters);
    if (!validated) {
        return null;
    }
    if (typeof executablePath !== 'string' || executablePath.trim().length === 0) {
        return null;
    }

    const args = ['/CREATE', '/F', '/SC', validated.frequency, '/TN', SCHEDULED_TASK_NAME];

    if (validated.dayOfWeek) {
        args.push('/D', validated.dayOfWeek);
    }
    if (validated.dayOfMonth !== undefined) {
        args.push('/D', String(validated.dayOfMonth));
    }

    args.push('/TR', `"${executablePath}" --collection-only`);
    args.push('/ST', validated.time);
    return args;
};
