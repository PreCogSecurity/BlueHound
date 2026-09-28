import test from 'node:test';
import assert from 'node:assert/strict';

import { pageReducer, PAGE_INITIAL_STATE, DASHBOARD_PAGES_INITIAL_STATE } from '../PageReducer.tsx';
import {
    CREATE_REPORT,
    FORCE_REFRESH_PAGE,
    REMOVE_REPORT,
    SHIFT_REPORT_LEFT,
    SHIFT_REPORT_RIGHT,
    createReport,
    forceRefreshPage,
    removeReport,
    setPageTitle,
    shiftReportLeft,
    shiftReportRight,
} from '../PageActions.tsx';
import { updateReportSize, updateReportTitle } from '../../card/CardActions.tsx';

const makeReport = (title: string) => ({ title, query: 'MATCH (n) RETURN n', fields: [] });

const pageWith = (...titles: string[]) => ({
    title: 'Test page',
    reports: titles.map(makeReport),
});

const titlesOf = (page: any) => page.reports.map((report: any) => report.title);

test('pageReducer returns the initial state for an unknown action', () => {
    assert.deepEqual(pageReducer(undefined, { type: 'SOMETHING_ELSE', payload: {} }), PAGE_INITIAL_STATE);
});

test('pageReducer ignores actions that are not scoped to a page', () => {
    const state = pageWith('A');
    assert.equal(pageReducer(state, { type: 'APPLICATION/SET_CONNECTED', payload: {} }), state);
});

test('pageReducer creates a report at the end of the page', () => {
    const state = pageWith('A', 'B');
    const actual = pageReducer(state, createReport(0, makeReport('C')));

    assert.deepEqual(titlesOf(actual), ['A', 'B', 'C']);
    assert.equal(actual.title, 'Test page');
    // The page that was handed in must not have been appended to.
    assert.deepEqual(titlesOf(state), ['A', 'B']);
});

test('pageReducer removes the report at the given index', () => {
    const state = pageWith('A', 'B', 'C');
    const actual = pageReducer(state, removeReport(0, 1));

    assert.deepEqual(titlesOf(actual), ['A', 'C']);
    // The card that moves into the removed slot must not animate into place.
    assert.equal(actual.reports[1].collapseTimeout, 0);
});

test('pageReducer removes the last report without touching its neighbours', () => {
    const state = pageWith('A', 'B', 'C');
    const actual = pageReducer(state, removeReport(0, 2));

    assert.deepEqual(titlesOf(actual), ['A', 'B']);
    assert.equal(actual.reports[1].collapseTimeout, undefined);
});

test('pageReducer shifts a report to the left', () => {
    const state = pageWith('A', 'B', 'C');
    const actual = pageReducer(state, shiftReportLeft(0, 2));

    assert.deepEqual(titlesOf(actual), ['A', 'C', 'B']);
});

test('pageReducer does not mutate the state when shifting a report left', () => {
    const state = pageWith('A', 'B', 'C');
    pageReducer(state, shiftReportLeft(0, 2));

    assert.deepEqual(titlesOf(state), ['A', 'B', 'C']);
    assert.equal(state.reports[1].collapseTimeout, undefined);
});

test('pageReducer leaves the first report in place when shifting left', () => {
    const state = pageWith('A', 'B', 'C');
    const actual = pageReducer(state, shiftReportLeft(0, 0));

    assert.deepEqual(titlesOf(actual), ['A', 'B', 'C']);
});

test('pageReducer shifts a report to the right', () => {
    const state = pageWith('A', 'B', 'C');
    const actual = pageReducer(state, shiftReportRight(0, 0));

    assert.deepEqual(titlesOf(actual), ['B', 'A', 'C']);
});

test('pageReducer does not build a sparse array for an out-of-range shift', () => {
    const state = pageWith('A', 'B');
    const actual = pageReducer(state, shiftReportRight(0, 7));

    assert.deepEqual(titlesOf(actual), ['A', 'B']);
    assert.equal(actual.reports.length, 2);
});

test('pageReducer sets the page title', () => {
    const actual = pageReducer(pageWith('A'), setPageTitle(0, 'Renamed page'));
    assert.equal(actual.title, 'Renamed page');
});

test('pageReducer appends a field to every report when forcing a refresh', () => {
    const state = pageWith('A', 'B');
    const actual = pageReducer(state, forceRefreshPage(0));

    assert.deepEqual(actual.reports[0].fields, ['']);
    assert.deepEqual(actual.reports[1].fields, ['']);
    // The reports themselves are untouched.
    assert.equal(actual.reports[0].title, 'A');
});

test('pageReducer delegates PAGE/CARD actions to the card reducer', () => {
    const state = pageWith('A', 'B');
    const actual = pageReducer(state, updateReportTitle(0, 1, 'Renamed card'));

    assert.deepEqual(titlesOf(actual), ['A', 'Renamed card']);
    // Sibling reports are passed through untouched.
    assert.equal(actual.reports[0], state.reports[0]);
});

test('pageReducer delegates card resizing to the card reducer', () => {
    const state = pageWith('A');
    const actual = pageReducer(state, updateReportSize(0, 0, 6, 4));

    assert.equal(actual.reports[0].width, 6);
    assert.equal(actual.reports[0].height, 4);
});

test('pageReducer keeps its action type constants stable', () => {
    // These strings are part of the persisted dashboard format; changing one
    // silently invalidates every dashboard a customer has saved.
    assert.equal(createReport(0, {}).type, CREATE_REPORT);
    assert.equal(removeReport(0, 0).type, REMOVE_REPORT);
    assert.equal(shiftReportLeft(0, 0).type, SHIFT_REPORT_LEFT);
    assert.equal(shiftReportRight(0, 0).type, SHIFT_REPORT_RIGHT);
    assert.equal(forceRefreshPage(0).type, FORCE_REFRESH_PAGE);
});

test('the bundled default dashboard is well formed', () => {
    // The default dashboard is the product's first-run experience and is
    // persisted straight into the user's profile, so a truncated or malformed
    // entry here ships a broken application to every new install.
    assert.ok(Array.isArray(DASHBOARD_PAGES_INITIAL_STATE));
    assert.ok(DASHBOARD_PAGES_INITIAL_STATE.length > 0);

    for (const page of DASHBOARD_PAGES_INITIAL_STATE) {
        assert.equal(typeof page.title, 'string');
        assert.ok(Array.isArray(page.reports));
        for (const report of page.reports) {
            assert.equal(typeof report.title, 'string');
            assert.equal(typeof report.query, 'string');
        }
    }
});

test('pageReducer starts from an empty page', () => {
    assert.deepEqual(PAGE_INITIAL_STATE, { title: '', reports: [] });
});
