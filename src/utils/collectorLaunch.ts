/**
 * Validation for the collection tools BlueHound launches.
 *
 * Tool paths and arguments come from the renderer, and the renderer reads them
 * from persisted state that an analyst can fill in from an imported or shared
 * BlueHound configuration. They are handed to `child_process.spawn`, which
 * throws a synchronous `TypeError` for anything that is not a string or an
 * array of strings - inside an async IPC handler that surfaces as an
 * unhandled rejection rather than a message the analyst can act on.
 *
 * Normalising here means one code path, one error message, and no chance of a
 * caller accidentally opting into `shell: true`.
 */

const MAX_TOOL_PATH_LENGTH = 4096;
const MAX_ARGUMENTS = 256;
const MAX_ARGUMENT_LENGTH = 32768;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export interface ToolInvocation {
    path: string;
    args: string[];
}

/**
 * Returns a validated invocation, or `null` when the input is unusable.
 * The returned `args` is a fresh array, so a caller can safely prepend to it.
 */
export const normaliseToolInvocation = (toolPath: unknown, toolArgs: unknown): ToolInvocation | null => {
    if (typeof toolPath !== 'string') {
        return null;
    }
    const executable = toolPath.trim();
    if (executable.length === 0 || executable.length > MAX_TOOL_PATH_LENGTH || CONTROL_CHARACTERS.test(executable)) {
        return null;
    }

    // A missing argument list is a normal case: several collectors take none.
    if (toolArgs === undefined || toolArgs === null) {
        return { path: executable, args: [] };
    }
    if (!Array.isArray(toolArgs) || toolArgs.length > MAX_ARGUMENTS) {
        return null;
    }

    const args: string[] = [];
    for (const arg of toolArgs) {
        // Arguments are passed to spawn as discrete argv entries, so they are
        // never re-parsed by a shell. Control characters and NUL bytes are still
        // rejected because they corrupt argv handling on Windows.
        if (typeof arg !== 'string' || arg.length > MAX_ARGUMENT_LENGTH || CONTROL_CHARACTERS.test(arg)) {
            return null;
        }
        args.push(arg);
    }

    return { path: executable, args };
};
