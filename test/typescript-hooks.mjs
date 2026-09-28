/**
 * Zero-dependency TypeScript loader for the Node.js built-in test runner.
 *
 * BlueHound's unit tests exercise real production modules that are written as
 * TypeScript (`.ts`) and TSX-without-JSX (`.tsx`). Node can strip types from
 * `.ts` files on its own, but it refuses to even load `.tsx`, and the previous
 * test setup (`ts-mocha`) was never installed as a dependency, so `npm test`
 * could not run from a fresh clone.
 *
 * This hook makes every `.ts`/`.tsx`/`.mts`/`.cts` module loadable by
 * `node --test` with no third-party packages at all. See the `test` script in
 * package.json for the exact invocation.
 * The hook only strips *type* syntax. It deliberately does not transform
 * enums, namespaces or JSX; those would need a real compiler (see `npm run
 * build`), so tests target the pure logic modules and never the React views.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', '/index.ts', '/index.tsx'];

const extensionOf = (value) => {
    const withoutQuery = value.split(/[?#]/)[0];
    const dot = withoutQuery.lastIndexOf('.');
    return dot === -1 ? '' : withoutQuery.slice(dot).toLowerCase();
};

/** `./Card` has no extension, but `./Card.js` and `./.eslintrc` do not match. */
const hasScriptExtension = (value) => /\.[cm]?[jt]sx?$/i.test(value.split(/[?#]/)[0]);

registerHooks({
    // BlueHound's source files use the extensionless import style that webpack
    // and ts-node accept. ESM resolution does not, so relative specifiers get a
    // second chance with each TypeScript extension appended.
    resolve(specifier, context, nextResolve) {
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
        if (isRelative && !hasScriptExtension(specifier)) {
            let firstError;
            for (const suffix of CANDIDATE_SUFFIXES) {
                try {
                    return nextResolve(specifier + suffix, context);
                } catch (error) {
                    firstError = firstError ?? error;
                }
            }
            throw firstError;
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.startsWith('file:') && TYPESCRIPT_EXTENSIONS.has(extensionOf(url))) {
            const source = readFileSync(fileURLToPath(url), 'utf8');
            return {
                format: 'module',
                source: stripTypeScriptTypes(source, { mode: 'strip' }),
                shortCircuit: true,
            };
        }
        return nextLoad(url, context);
    },
});
