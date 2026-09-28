import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliseToolInvocation } from '../collectorLaunch.ts';

test('accepts a collector with no arguments', () => {
    const actual = normaliseToolInvocation('C:\\tools\\SharpHound.exe', []);
    assert.deepEqual(actual, { path: 'C:\\tools\\SharpHound.exe', args: [] });
});

test('treats a missing argument list as no arguments', () => {
    // Several collectors take none, and the renderer sends undefined for them.
    assert.deepEqual(normaliseToolInvocation('C:\\tools\\ShotHound.exe', undefined), {
        path: 'C:\\tools\\ShotHound.exe',
        args: [],
    });
    assert.deepEqual(normaliseToolInvocation('C:\\tools\\ShotHound.exe', null), {
        path: 'C:\\tools\\ShotHound.exe',
        args: [],
    });
});

test('keeps arguments as discrete argv entries', () => {
    const actual = normaliseToolInvocation('SharpHound.exe', ['-d', 'corp.local', '--CollectionMethod', 'Group']);
    assert.deepEqual(actual?.args, ['-d', 'corp.local', '--CollectionMethod', 'Group']);
});

test('does not treat argument text as a shell command', () => {
    // The value is a single argv entry; there is no shell to re-parse it, and
    // the normaliser must not split, glob or expand it.
    const actual = normaliseToolInvocation('SharpHound.exe', ['-d', 'corp.local & calc.exe']);
    assert.deepEqual(actual?.args, ['-d', 'corp.local & calc.exe']);
});

test('trims the executable path', () => {
    assert.equal(normaliseToolInvocation('  C:\\tools\\SharpHound.exe  ', [])?.path, 'C:\\tools\\SharpHound.exe');
});

test('returns a fresh array so callers can safely prepend to it', () => {
    const original = ['-d', 'corp.local'];
    const actual = normaliseToolInvocation('vulnparser.py', original);
    actual?.args.unshift('C:\\tools\\vulnparser.py');

    assert.deepEqual(original, ['-d', 'corp.local']);
    assert.equal(actual?.args[0], 'C:\\tools\\vulnparser.py');
});

test('rejects a missing or empty executable path', () => {
    for (const toolPath of ['', '   ', undefined, null, 42, {}, [], true]) {
        assert.equal(normaliseToolInvocation(toolPath, []), null, `expected ${JSON.stringify(toolPath)} to be rejected`);
    }
});

test('rejects an executable path containing control characters', () => {
    assert.equal(normaliseToolInvocation('C:\\tools\\evil\u0000.exe', []), null);
    assert.equal(normaliseToolInvocation('C:\\tools\\evil\nexe', []), null);
});

test('rejects an over-long executable path', () => {
    assert.equal(normaliseToolInvocation('C:\\tools\\' + 'a'.repeat(5000) + '.exe', []), null);
});

test('rejects an argument list that is not an array of strings', () => {
    for (const toolArgs of ['-d corp.local', { '-d': 'corp.local' }, 42, [1, 2, 3], [null], [undefined], [{ toString: () => 'x' }]]) {
        assert.equal(normaliseToolInvocation('SharpHound.exe', toolArgs), null, `expected ${JSON.stringify(toolArgs)} to be rejected`);
    }
});

test('rejects arguments containing control characters or NUL bytes', () => {
    assert.equal(normaliseToolInvocation('SharpHound.exe', ['-d\u0000corp']), null);
    assert.equal(normaliseToolInvocation('SharpHound.exe', ['-d\ncorp']), null);
});

test('rejects an absurdly long or wide argument list', () => {
    assert.equal(normaliseToolInvocation('SharpHound.exe', ['a'.repeat(40000)]), null);
    assert.equal(normaliseToolInvocation('SharpHound.exe', new Array(300).fill('-d')), null);
});
