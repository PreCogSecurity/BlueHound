import test from 'node:test';
import assert from 'node:assert/strict';

import { applicationReducer } from '../ApplicationReducer.tsx';
import {
    CLEAR_NOTIFICATION,
    CREATE_NOTIFICATION,
    RESET_SHARE_DETAILS,
    SET_COLLECTION_MODAL_OPEN,
    SET_CONNECTED,
    SET_CONNECTION_PROPERTIES,
    SET_DB_VERSION,
    SET_SHARE_DETAILS_FROM_URL,
    SET_STANDALONE_MODE,
    SET_TOOLS_PARAMETERS,
    createNotification,
    clearNotification,
    resetShareDetails,
    setCollectionModalOpen,
    setConnected,
    setConnectionProperties,
    setDBVersion,
    setShareDetailsFromUrl,
    setStandAloneMode,
    setToolsParameters,
} from '../ApplicationActions.tsx';

test('applicationReducer ignores actions outside the APPLICATION scope', () => {
    const state = { notificationTitle: 'kept' } as any;
    assert.equal(applicationReducer(state, { type: 'PAGE/SET_TITLE', payload: {} }), state);
});

test('applicationReducer creates and clears notifications', () => {
    const created = applicationReducer(undefined, createNotification('Upload finished', '2 of 3 files'));
    assert.equal(created.notificationTitle, 'Upload finished');
    assert.equal(created.notificationMessage, '2 of 3 files');

    const cleared = applicationReducer(created, clearNotification());
    assert.equal(cleared.notificationTitle, null);
    assert.equal(cleared.notificationMessage, null);
});

test('applicationReducer tracks the connection state', () => {
    const connected = applicationReducer(undefined, setConnected(true));
    assert.equal(connected.connected, true);

    const disconnected = applicationReducer(connected, setConnected(false));
    assert.equal(disconnected.connected, false);
});

test('applicationReducer stores the reported Neo4j version', () => {
    const actual = applicationReducer(undefined, setDBVersion('5.13.0'));
    assert.equal(actual.dbVersion, '5.13.0');
});

test('applicationReducer opens and closes the collection modal', () => {
    const open = applicationReducer(undefined, setCollectionModalOpen(true));
    assert.equal(open.collectionModalOpen, true);
    const closed = applicationReducer(open, setCollectionModalOpen(false));
    assert.equal(closed.collectionModalOpen, false);
});

test('applicationReducer never leaves the connection password undefined', () => {
    // The connection modal binds directly to this field; an undefined value
    // turns the password field into an uncontrolled input.
    const initial = applicationReducer(undefined, { type: 'APPLICATION/NOOP', payload: {} });
    assert.equal(initial.connection.password, '');

    const configured = applicationReducer(
        initial,
        setConnectionProperties('bolt', 'db.corp.local', '7687', '', 'neo4j', 'hunter2', true),
    );
    assert.equal(configured.connection.url, 'db.corp.local');
    assert.equal(configured.connection.password, 'hunter2');
    assert.equal(configured.connection.successful, true);
});

test('applicationReducer stores shared dashboard details from a URL', () => {
    const actual = applicationReducer(
        undefined,
        setShareDetailsFromUrl('dashboard', 'abc123', true, 'bolt', 'db.corp.local', '7687', '', 'neo4j', 'hunter2'),
    );

    assert.equal(actual.shareDetails.id, 'abc123');
    assert.equal(actual.shareDetails.standalone, true);
    assert.equal(actual.shareDetails.url, 'db.corp.local');

    const reset = applicationReducer(actual, resetShareDetails());
    assert.equal(reset.shareDetails, undefined);
});

test('applicationReducer stores collector tool parameters', () => {
    const toolsParameters = [{ path: 'C:/tools/SharpHound.exe', args: ['-d', 'corp.local'] }];
    const actual = applicationReducer(undefined, setToolsParameters(toolsParameters));
    assert.deepEqual(actual.toolsParameters, toolsParameters);
});

test('applicationReducer tracks standalone mode', () => {
    assert.equal(applicationReducer(undefined, setStandAloneMode(true)).standalone, true);
});

test('applicationReducer keeps its action type constants stable', () => {
    assert.equal(createNotification('a', 'b').type, CREATE_NOTIFICATION);
    assert.equal(clearNotification().type, CLEAR_NOTIFICATION);
    assert.equal(setConnected(true).type, SET_CONNECTED);
    assert.equal(setDBVersion('5.0.0').type, SET_DB_VERSION);
    assert.equal(setCollectionModalOpen(true).type, SET_COLLECTION_MODAL_OPEN);
    assert.equal(resetShareDetails().type, RESET_SHARE_DETAILS);
    assert.equal(setStandAloneMode(true).type, SET_STANDALONE_MODE);
    assert.equal(setToolsParameters([]).type, SET_TOOLS_PARAMETERS);
    assert.equal(
        setConnectionProperties('bolt', 'localhost', '7687', '', 'neo4j', '', false).type,
        SET_CONNECTION_PROPERTIES,
    );
    assert.equal(setShareDetailsFromUrl('t', 'i', false, 'bolt', 'u', '1', '', 'n', 'p').type, SET_SHARE_DETAILS_FROM_URL);
});
