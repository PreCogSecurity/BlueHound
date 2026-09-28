import test from 'node:test';
import assert from 'node:assert/strict';

import { isSafeExternalUrl, safeExternalUrl } from '../../utils/externalLink.ts';

test('accepts ordinary web links', () => {
    assert.equal(isSafeExternalUrl('https://bloodhound.specterops.io'), true);
    assert.equal(isSafeExternalUrl('http://zeronetworks.com/blog/bluehound'), true);
});

test('rejects schemes that would launch a local or privileged handler', () => {
    // Each of these is a real code-execution or credential-theft primitive when
    // handed to shell.openExternal().
    const dangerous = [
        'file:///C:/Windows/System32/calc.exe',
        'smb://attacker.example/share',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'ms-msdt:/id PCWDiagnostic /skip force /param',
        'ms-officecmd:',
        'search-ms:query=x&crumb=location:\\\\attacker\\share',
        'blob:https://evil.example/1234',
        'about:blank',
    ];

    for (const url of dangerous) {
        assert.equal(isSafeExternalUrl(url), false, `expected ${url} to be rejected`);
    }
});

test('rejects URLs with embedded credentials', () => {
    assert.equal(isSafeExternalUrl('https://user:hunter2@example.com/'), false);
});

test('rejects non-string and malformed input', () => {
    for (const value of [undefined, null, 42, {}, [], '', '   ', 'not a url', '//example.com']) {
        assert.equal(isSafeExternalUrl(value), false, `expected ${JSON.stringify(value)} to be rejected`);
    }
});

test('rejects control characters that would split a shell argument', () => {
    assert.equal(isSafeExternalUrl('https://example.com/\r\nwhoami'), false);
    assert.equal(isSafeExternalUrl('https://example.com/\u0000.exe'), false);
});

test('rejects an absurdly long URL', () => {
    assert.equal(isSafeExternalUrl(`https://example.com/${'a'.repeat(4096)}`), false);
});

test('safeExternalUrl returns the normalised URL for links that pass', () => {
    assert.equal(safeExternalUrl('  https://example.com/path  '), 'https://example.com/path');
    assert.equal(safeExternalUrl('file:///etc/passwd'), null);
});
