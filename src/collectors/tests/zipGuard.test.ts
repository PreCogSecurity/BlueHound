import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import zipGuard from '../zipGuard.js';

const { safeArchiveEntryName, resolveWithinDirectory, sanitizeFileName } = zipGuard;

const BASE = path.resolve(path.sep === '\\' ? 'C:\\Users\\analyst\\AppData\\Local\\Temp' : '/tmp/bluehound');

test('keeps an ordinary result file', () => {
    assert.equal(safeArchiveEntryName('corp.local_computers.json'), 'corp.local_computers.json');
});

test('keeps an entry that lives in a sub-directory but flattens it', () => {
    // BloodHound zips nest files; extraction into a flat temp directory is the
    // existing behaviour and is safe as long as the name cannot traverse.
    assert.equal(safeArchiveEntryName('2024-01-01/corp.local_users.json'), 'corp.local_users.json');
});

test('rejects relative traversal in the entry name', () => {
    for (const entry of [
        '../evil.json',
        '../../.ssh/authorized_keys',
        'sub/../../evil.json',
        '..',
        '../',
        './../evil.json',
    ]) {
        assert.equal(safeArchiveEntryName(entry), null, `expected ${entry} to be rejected`);
    }
});

test('rejects absolute and Windows drive-letter entry names', () => {
    for (const entry of ['/etc/cron.d/evil', 'C:\\Windows\\System32\\evil.dll', 'c:/windows/system32/evil.dll']) {
        assert.equal(safeArchiveEntryName(entry), null, `expected ${entry} to be rejected`);
    }
});

test('rejects Windows-style traversal inside a POSIX entry name', () => {
    assert.equal(safeArchiveEntryName('..\\..\\evil.json'), null);
    assert.equal(safeArchiveEntryName('sub\\..\\..\\evil.json'), null);
});

test('rejects control characters and null bytes', () => {
    assert.equal(safeArchiveEntryName('evil\u0000.json'), null);
    assert.equal(safeArchiveEntryName('evil\n.json'), null);
});

test('rejects entry names that sanitise to nothing', () => {
    for (const entry of ['', '.', './', '...', '   ', '<<<']) {
        assert.equal(safeArchiveEntryName(entry), null, `expected ${JSON.stringify(entry)} to be rejected`);
    }
});

test('rejects non-string entry names', () => {
    for (const entry of [undefined, null, 42, {}, []]) {
        assert.equal(safeArchiveEntryName(entry), null);
    }
});

test('resolves a safe file inside the extraction directory', () => {
    const resolved = resolveWithinDirectory(BASE, 'corp.local_users.json');
    assert.equal(resolved, path.join(BASE, 'corp.local_users.json'));
    assert.ok(resolved.startsWith(BASE + path.sep));
});

test('refuses to resolve anything that escapes the extraction directory', () => {
    for (const name of [
        '..',
        '../evil.json',
        '../../evil.json',
        '..\\evil.json',
        'sub/evil.json',
        'C:\\Windows\\System32\\evil.dll',
        '/etc/passwd',
        'evil\u0000.json',
    ]) {
        assert.equal(resolveWithinDirectory(BASE, name), null, `expected ${name} to be rejected`);
    }
});

test('refuses to resolve against a sibling directory that shares a prefix', () => {
    // `/tmp/bluehound-evil` starts with `/tmp/bluehound` as a string but is a
    // different directory; a naive startsWith() check would allow it.
    assert.equal(resolveWithinDirectory(BASE, path.join('..', 'bluehound-evil', 'evil.json')), null);
});

test('refuses non-string arguments', () => {
    assert.equal(resolveWithinDirectory(undefined as any, 'a.json'), null);
    assert.equal(resolveWithinDirectory(BASE, undefined as any), null);
});

test('sanitizeFileName strips characters that are illegal in a file name', () => {
    assert.equal(sanitizeFileName('a<b>c:d"e|f?g*h.json'), 'abcdefgh.json');
    assert.equal(sanitizeFileName('..hidden.json'), 'hidden.json');
    assert.equal(sanitizeFileName('trailing.'), 'trailing');
    assert.equal(sanitizeFileName('  spaced  '), 'spaced');
});
