/**
 * Allow-list for URLs that the Electron shell is allowed to hand to the
 * operating system.
 *
 * `shell.openExternal()` launches whatever handler the OS has registered for
 * the URL's scheme. BlueHound renders report descriptions, chart `infoURL`s and
 * shared community dashboards, so the URL reaching that call is attacker
 * influenced input: a `file://` link reads local files, an `smb://` link leaks
 * NTLM hashes to a remote host, and handlers such as `ms-msdt:` have been used
 * as living-off-the-land code execution primitives. Only ordinary web links are
 * ever legitimate here.
 */

export const ALLOWED_EXTERNAL_PROTOCOLS = ['https:', 'http:'] as const;

const MAX_URL_LENGTH = 2048;

/** Rejects raw control characters, which split arguments on Windows shells. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export const isSafeExternalUrl = (candidate: unknown): boolean => safeExternalUrl(candidate) !== null;

/**
 * Returns the URL when it is safe to hand to `shell.openExternal`, otherwise
 * `null`. Use the return value rather than the boolean so the caller never
 * opens a URL it has not validated.
 */
export const safeExternalUrl = (candidate: unknown): string | null => {
    if (typeof candidate !== 'string') {
        return null;
    }
    const trimmed = candidate.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH || CONTROL_CHARACTERS.test(trimmed)) {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch (e) {
        return null;
    }

    if (!(ALLOWED_EXTERNAL_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
        return null;
    }
    // Embedded credentials would be written to the OS handler invocation and
    // to the shell history of whatever app opens the link.
    if (parsed.username !== '' || parsed.password !== '') {
        return null;
    }
    return parsed.toString();
};
