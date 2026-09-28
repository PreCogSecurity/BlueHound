import test from 'node:test';
import assert from 'node:assert/strict';

import cardReducer, { CARD_INITIAL_STATE } from '../CardReducer.tsx';
import {
    CLEAR_SELECTION,
    HARD_RESET_CARD_SETTINGS,
    TOGGLE_CARD_INFO,
    TOGGLE_CARD_SETTINGS,
    TOGGLE_REPORT_SETTINGS,
    UPDATE_ALL_SELECTIONS,
    UPDATE_CYPHER_PARAMETERS,
    UPDATE_FIELDS,
    UPDATE_INFO_URL,
    UPDATE_QUERY_INFO,
    UPDATE_REPORT_QUERY,
    UPDATE_REPORT_REFRESH_RATE,
    UPDATE_REPORT_SETTING,
    UPDATE_REPORT_SIZE,
    UPDATE_REPORT_TITLE,
    UPDATE_REPORT_TYPE,
    UPDATE_SELECTION,
    clearSelection,
    hardResetCardSettings,
    toggleCardInfo,
    toggleCardSettings,
    toggleReportSettings,
    updateAllSelections,
    updateCypherParameters,
    updateFields,
    updateInfoURL,
    updateQueryInfo,
    updateReportQuery,
    updateReportRefreshRate,
    updateReportSetting,
    updateReportSize,
    updateReportTitle,
    updateReportType,
    updateSelection,
} from '../CardActions.tsx';

test('cardReducer returns the initial state for an unknown card action', () => {
    const actual = cardReducer(undefined, { type: 'SOMETHING_ELSE', payload: {} });
    assert.deepEqual(actual, CARD_INITIAL_STATE);
});

test('cardReducer ignores actions that are not scoped to a card', () => {
    const state = { ...CARD_INITIAL_STATE, title: 'Report' };
    const actual = cardReducer(state, { type: 'PAGE/SET_TITLE', payload: { pagenumber: 0, title: 'nope' } });
    // Must be the same reference: a reducer that rebuilds state for a foreign
    // action defeats every downstream `===` comparison in the render tree.
    assert.equal(actual, state);
});

test('cardReducer returns the same state for an unhandled PAGE/CARD action', () => {
    const state = { ...CARD_INITIAL_STATE };
    const actual = cardReducer(state, { type: 'PAGE/CARD/SOMETHING_NEW', payload: {} });
    assert.equal(actual, state);
});

test('cardReducer updates the card title', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportTitle(0, 0, 'Vulnerable Hosts'));
    assert.equal(actual.title, 'Vulnerable Hosts');
});

test('cardReducer updates the card width and height together', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportSize(0, 2, 6, 4));
    assert.equal(actual.width, 6);
    assert.equal(actual.height, 4);
});

test('cardReducer updates the card query', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportQuery(0, 0, 'MATCH (n) RETURN n'));
    assert.equal(actual.query, 'MATCH (n) RETURN n');
});

test('cardReducer updates the card refresh rate', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportRefreshRate(0, 0, 60));
    assert.equal(actual.refreshRate, 60);
});

test('cardReducer updates the cypher parameters', () => {
    const parameters = { domain: ['corp.local'] };
    const actual = cardReducer(CARD_INITIAL_STATE, updateCypherParameters(0, 0, parameters));
    assert.deepEqual(actual.parameters, parameters);
});

test('cardReducer updates query info and the info URL independently', () => {
    const withInfo = cardReducer(CARD_INITIAL_STATE, updateQueryInfo(0, 0, 'Shows every short path'));
    const withUrl = cardReducer(withInfo, updateInfoURL(0, 0, 'https://bloodhound.specterops.io'));
    assert.equal(withInfo.queryInfo, 'Shows every short path');
    assert.equal(withUrl.infoURL, 'https://bloodhound.specterops.io');
    // The first update must not be lost by the second one.
    assert.equal(withUrl.queryInfo, 'Shows every short path');
});

test('cardReducer updates the card fields', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateFields(0, 0, ['name', 'objectid']));
    assert.deepEqual(actual.fields, ['name', 'objectid']);
});

test('cardReducer updates the card type', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportType(0, 0, 'graph'));
    assert.equal(actual.type, 'graph');
});

test('cardReducer merges a single selection into the existing selection', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateSelection(0, 0, 'bluehound_group_name', 'Domain Admins@CORP.LOCAL'));
    const actual = cardReducer(state, updateSelection(0, 0, 'bluehound_ou_name', 'Tier 0@CORP.LOCAL'));

    assert.deepEqual(actual.selection, {
        bluehound_group_name: 'Domain Admins@CORP.LOCAL',
        bluehound_ou_name: 'Tier 0@CORP.LOCAL',
    });
    // The previous state object must be untouched, otherwise the previous
    // card render in the same page would show the new selection too.
    assert.deepEqual(state.selection, { bluehound_group_name: 'Domain Admins@CORP.LOCAL' });
});

test('cardReducer replaces every selection with UPDATE_ALL_SELECTIONS', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateSelection(0, 0, 'bluehound_group_name', 'Domain Admins@CORP.LOCAL'));
    const actual = cardReducer(state, updateAllSelections(0, 0, { bluehound_ou_name: 'Tier 0@CORP.LOCAL' }));
    assert.deepEqual(actual.selection, { bluehound_ou_name: 'Tier 0@CORP.LOCAL' });
});

test('cardReducer clears the selection', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateSelection(0, 0, 'bluehound_group_name', 'Domain Admins@CORP.LOCAL'));
    const actual = cardReducer(state, clearSelection(0, 0));
    assert.deepEqual(actual.selection, {});
});

test('cardReducer stores a card setting', () => {
    const actual = cardReducer(CARD_INITIAL_STATE, updateReportSetting(0, 0, 'rowLimit', 100));
    assert.deepEqual(actual.settings, { rowLimit: 100 });
});

test('cardReducer deletes a card setting when the value is empty', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateReportSetting(0, 0, 'rowLimit', 100));
    // "" == 0 in JavaScript, so an empty string must still clear the setting.
    const actual = cardReducer(state, updateReportSetting(0, 0, 'rowLimit', ''));
    assert.deepEqual(actual.settings, {});
});

test('cardReducer keeps falsy-but-defined card setting values', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateReportSetting(0, 0, 'expandable', true));
    const actual = cardReducer(state, updateReportSetting(0, 0, 'expandable', false));
    // Only `undefined` and zero-length strings clear a setting; `false` and
    // `0` are legitimate values a chart can toggle.
    assert.deepEqual(actual.settings, { expandable: false });
});

test('cardReducer clears a card setting when the value is undefined', () => {
    const state = cardReducer(CARD_INITIAL_STATE, updateReportSetting(0, 0, 'rowLimit', 100));
    const actual = cardReducer(state, updateReportSetting(0, 0, 'rowLimit', undefined));
    assert.deepEqual(actual.settings, {});
});

test('cardReducer opens and closes the settings drawer', () => {
    const open = cardReducer(CARD_INITIAL_STATE, toggleCardSettings(0, 0, true));
    assert.equal(open.settingsOpen, true);
    assert.equal(open.collapseTimeout, 'auto');

    const closed = cardReducer(open, toggleCardSettings(0, 0, false));
    assert.equal(closed.settingsOpen, false);
});

test('cardReducer opens and closes the info drawer', () => {
    const open = cardReducer(CARD_INITIAL_STATE, toggleCardInfo(0, 0, true));
    assert.equal(open.infoOpen, true);
    const closed = cardReducer(open, toggleCardInfo(0, 0, false));
    assert.equal(closed.infoOpen, false);
});

test('cardReducer hard reset closes the drawers and freezes the card', () => {
    const open = cardReducer(CARD_INITIAL_STATE, toggleCardSettings(0, 0, true));
    const actual = cardReducer(open, hardResetCardSettings(0, 0));
    assert.equal(actual.settingsOpen, false);
    assert.equal(actual.collapseTimeout, 0);
});

test('cardReducer toggles the advanced (report) settings', () => {
    const opened = cardReducer(CARD_INITIAL_STATE, toggleReportSettings(0, 0));
    assert.equal(opened.advancedSettingsOpen, true);
    const closed = cardReducer(opened, toggleReportSettings(0, 0));
    assert.equal(closed.advancedSettingsOpen, false);
});

test('cardReducer reacts to hand-built actions as well as action creators', () => {
    // Guards the raw string constants, which are part of the Redux contract
    // shared with the persisted dashboards saved before a release.
    assert.equal(updateReportTitle(1, 2, 't').type, UPDATE_REPORT_TITLE);
    assert.equal(clearSelection(1, 2).type, CLEAR_SELECTION);
    assert.equal(updateReportSize(1, 2, 1, 1).type, UPDATE_REPORT_SIZE);
    assert.equal(updateReportQuery(1, 2, 'q').type, UPDATE_REPORT_QUERY);
    assert.equal(updateReportRefreshRate(1, 2, 5).type, UPDATE_REPORT_REFRESH_RATE);
    assert.equal(updateQueryInfo(1, 2, 'i').type, UPDATE_QUERY_INFO);
    assert.equal(updateInfoURL(1, 2, 'u').type, UPDATE_INFO_URL);
    assert.equal(updateFields(1, 2, ['a']).type, UPDATE_FIELDS);
    assert.equal(updateReportType(1, 2, 'table').type, UPDATE_REPORT_TYPE);
    assert.equal(updateAllSelections(1, 2, {}).type, UPDATE_ALL_SELECTIONS);
    assert.equal(updateSelection(1, 2, 'a', 'b').type, UPDATE_SELECTION);
    assert.equal(updateReportSetting(1, 2, 'a', 'b').type, UPDATE_REPORT_SETTING);
    assert.equal(toggleCardSettings(1, 2, true).type, TOGGLE_CARD_SETTINGS);
    assert.equal(toggleCardInfo(1, 2, true).type, TOGGLE_CARD_INFO);
    assert.equal(hardResetCardSettings(1, 2).type, HARD_RESET_CARD_SETTINGS);
    assert.equal(toggleReportSettings(1, 0).type, TOGGLE_REPORT_SETTINGS);
});

test('cardReducer does not mutate the state it is given', () => {
    const state = { ...CARD_INITIAL_STATE, settings: { rowLimit: 100 } };
    const snapshot = JSON.stringify(state);
    cardReducer(state, updateReportSetting(0, 0, 'rowLimit', 500));
    cardReducer(state, updateReportTitle(0, 0, 'changed'));
    assert.equal(JSON.stringify(state), snapshot);
});
