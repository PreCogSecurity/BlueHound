/**
 * Archive extraction guards for SharpHound / ShotHound result files.
 *
 * Result archives are supplied by the operator but their *contents* are not
 * trusted: a `.zip` produced by an attacker, or one harvested from a
 * compromised collection host, can name an entry `../../.ssh/authorized_keys`
 * or `C:\Windows\System32\...`. `adm-zip` happily joins that entry name onto
 * the target directory, which is the classic "zip slip" arbitrary-file-write.
 *
 * `sanitize-filename` alone is not sufficient here: it strips characters that
 * are illegal in a file *name* but leaves `..` segments and absolute paths
 * intact, and it runs on a value that is not the only thing that decides the
 * write location. Everything extracted by the ingestion pipeline must go
 * through `safeArchiveEntryName` + `resolveWithinDirectory`.
 *
 * Written as CommonJS because the ingestion pipeline that consumes it
 * (`BloodHoundUploader.tsx`) is CommonJS, and because it is required from the
 * Electron main process as well as the test runner.
 */
const path = require('path');

/** Path separators and control characters are never legitimate in our entries. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Characters that are illegal in a file name on the platforms we support. */
const ILLEGAL_NAME_CHARACTERS = /[\/\x00-\x1f\x7f<>:"|?*]/g;

/**
 * Local replacement for the `sanitize-filename` package: strips characters that
 * are illegal in a file name plus leading/trailing dots and spaces. Keeping this
 * in-tree removes a third-party package from an extraction path that handles
 * untrusted input, and keeps it unit-testable without an install.
 */
const sanitizeFileName = (name) =>
    String(name)
        .replace(ILLEGAL_NAME_CHARACTERS, '')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
        .trim();

/**
 * Reduces an archive entry name to a single, safe, flat file name inside the
 * extraction directory, or returns `null` when the entry must be rejected.
 *
 * Rejects (rather than repairs) anything that looks like a traversal attempt so
 * that a malicious archive produces a visible warning instead of a quietly
 * mangled file.
 */
const safeArchiveEntryName = (entryName) => {
    if (typeof entryName !== 'string') {
        return null;
    }

    // Zip entries are POSIX-style; a backslash means somebody is crafting a
    // Windows path traversal payload, and a leading slash or drive letter is an
    // absolute path that has no business being in an archive we extract.
    if (entryName.indexOf('\\') !== -1 || entryName.startsWith('/') || /^[a-zA-Z]:/.test(entryName) || CONTROL_CHARACTERS.test(entryName)) {
        return null;
    }

    const segments = entryName.split('/').filter((segment) => segment.length > 0 && segment !== '.');
    if (segments.length === 0 || segments.some((segment) => segment === '..')) {
        return null;
    }

    // Flatten to a single component: the ingestion pipeline only ever reads the
    // top level of the archive, and a flat name cannot escape the directory.
    const sanitized = sanitizeFileName(segments[segments.length - 1]);
    if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
        return null;
    }
    if (path.isAbsolute(sanitized) || /^[a-zA-Z]:/.test(sanitized)) {
        return null;
    }
    return sanitized;
};

/**
 * Resolves `fileName` inside `baseDirectory` and returns the absolute path,
 * or `null` when the result would land outside of it. This is the last line of
 * defence: it is checked after the join, not before.
 */
const resolveWithinDirectory = (baseDirectory, fileName) => {
    if (typeof baseDirectory !== 'string' || typeof fileName !== 'string') {
        return null;
    }
    if (fileName.indexOf('\\') !== -1 || fileName.indexOf('/') !== -1 || CONTROL_CHARACTERS.test(fileName)) {
        return null;
    }
    if (path.isAbsolute(fileName) || /^[a-zA-Z]:/.test(fileName)) {
        return null;
    }

    const base = path.resolve(baseDirectory);
    const resolved = path.resolve(base, fileName);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
        return null;
    }
    return resolved;
};

module.exports = { safeArchiveEntryName, resolveWithinDirectory, sanitizeFileName };
