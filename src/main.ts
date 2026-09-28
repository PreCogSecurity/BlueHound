const {app, BrowserWindow, ipcMain, dialog, shell, Menu, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { handleSharpHoundResultsUpload } = require('./collectors/BloodHoundUploader.tsx');
const { getLogger } = require('./utils/logger.ts');
const { safeExternalUrl } = require('./utils/externalLink.ts');
const { buildScheduleTaskArgs } = require('./utils/scheduledTask.ts');
const { normaliseToolInvocation } = require('./utils/collectorLaunch.ts');
const log = getLogger('main');
const logMessages = [];

let mainWindow;
const gotTheLock = app.requestSingleInstanceLock();
let shellEnvironments;
let logLevel = {
    0: "verbose",
    1: "info",
    2: "warning",
    3: "error"
}

function createWindow () {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        //titleBarStyle: "hidden",
        webPreferences: {
            // The renderer never needs Node: every privileged operation goes
            // through the narrow contextBridge API in src/preload.js. Leaving
            // nodeIntegration on meant that any script injection into report
            // text, a shared community dashboard or a markdown description was
            // remote code execution with the analyst's privileges.
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
            spellcheck: false,
            preload: path.join(__dirname, 'preload.js')
        },
    })

    // mainWindow.webContents.openDevTools();
    mainWindow.removeMenu();
    mainWindow.maximize();
    mainWindow.loadFile('./dist/index.html')

    if (process.platform === 'darwin') {
        const template = [
            {
                label: app.getName(),
                submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
            }
            ]
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }


    import('shell-env').then(envPath => { shellEnvironments = envPath.shellEnvSync(); })

    // open links in a browser instead of in the electron window, but only for
    // links that are actually web links: shell.openExternal hands the URL to an
    // OS protocol handler, so file://, smb:// or ms-msdt:// from a report
    // description would be a local file read or a code-execution primitive.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const safeUrl = safeExternalUrl(url);
        if (safeUrl) {
            shell.openExternal(safeUrl);
        } else {
            log.warn('Blocked a link that is not a plain web URL', { url });
        }
        return { action: 'deny' };
    });

    // BlueHound is a single-window application: any attempt to navigate the
    // window away from the bundled UI is either a bug or an injection attempt.
    mainWindow.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
        log.warn('Blocked an in-app navigation', { url });
    });

    // BlueHound needs no device permissions. Denying by default stops a
    // malicious dashboard from silently turning on the microphone or webcam.
    mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
        log.warn('Blocked a device permission request');
        callback(false);
    });
    mainWindow.webContents.session.setPermissionCheckHandler(() => false);

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        let fileName = sourceId.replace(/^.*[\\\/]/, '');
        if (os.platform() === 'win32') fileName = sourceId.split('\\')[-1];
        logMessages.push([logLevel[level], message, fileName].join(' | '));
    });

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        log.error('The renderer process stopped unexpectedly', details);
    });
}

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
        if (commandLine.includes('--collection-only')) {
            mainWindow.webContents.send('run-all-collection');
        };

        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    app.whenReady().then(() => {
        createWindow();
    })
}

//app.on('ready', createWindow);

const runningProcesses = {};

const isCollectionOnly = () => {
    return process.argv.includes('--collection-only');
}

ipcMain.handle("app-loaded", async (event) => {
    if (isCollectionOnly()) {
        dialog.showMessageBox(mainWindow, {
            title: 'Collection-only mode',
            buttons: ['Dismiss'],
            type: 'info',
            message: 'BlueHound is running in collection-only mode…',
        });
        event.sender.send('run-all-collection', '');
    }
});

ipcMain.handle("open-dev-tools", async (event) => {
    await mainWindow.webContents.openDevTools();
});

ipcMain.handle("get-console-messages", async (event) => {
    event.sender.send('console-messages', logMessages.join('\n'));
});

ipcMain.handle("browse-file", async (event, toolId) => {
    const file = await dialog.showOpenDialog({properties: (os.platform() === 'linux' || os.platform() === 'win32') ? ['openFile'] : ['openFile', 'openDirectory']});
    if (file && file.filePaths[0]) {
        event.sender.send('selected-file', toolId, file.filePaths[0]);
    }
});

ipcMain.handle("browse-folder", async (event, toolId) => {
    const folder = await dialog.showOpenDialog({properties: ['openDirectory']});
    if (folder && folder.filePaths[0]) {
        event.sender.send('selected-file', toolId, folder.filePaths[0]);
    }
});

function getPythonBinaryName() {
    const isPyAvailable = require('hasbin').sync('python')
    const isPy3Available = require('hasbin').sync('python3')
    return isPyAvailable ? "python" : (isPy3Available ? "python3" : null)
}

const runTool = async (event, toolId, toolPath, tookArgs, workingDirectory) => {
    const invocation = normaliseToolInvocation(toolPath, tookArgs);
    if (!invocation) {
        log.warn('Rejected a collector launch with invalid parameters', { toolId });
        event.sender.send("tool-data-error", toolId, 'Invalid tool path or arguments for this collector.');
        event.sender.send("tool-data-done", toolId, -1, workingDirectory);
        return;
    }

    // No `shell: true` anywhere in the collector launch path: arguments stay
    // discrete argv entries and are never interpreted by cmd.exe or sh.
    const result = spawn(invocation.path, invocation.args, { env: shellEnvironments, cwd: workingDirectory })
    runningProcesses[toolId] = result;

    result.stdout.on('data', (data) => {
        event.sender.send("tool-data", toolId, data.toString())
    });

    result.stderr.on('data', (data) => {
        event.sender.send("tool-data-error", toolId, data.toString())
    });

    result.on('error', function (err) { // needed for catching ENOENT
        log.error('Collector failed to start', { toolId, error: err });
        event.sender.send("tool-data-error", toolId, err)
    });

    result.on('close', (code) => {
        event.sender.send("tool-data-done", toolId, code, path.dirname(invocation.path))
        delete runningProcesses[toolId];
    });
}

ipcMain.handle("run-tool", async (event, toolId, toolPath, toolArgs) => {
    import('shell-env').then(envPath => { shellEnvironments = envPath.shellEnvSync(); })
    const workingDirectory = typeof toolPath === 'string' ? path.dirname(toolPath) : '.';
    await runTool(event, toolId, toolPath, toolArgs, workingDirectory);
})

const runToolsInSerial = async (event, toolsData) => {
    if (!Array.isArray(toolsData) || toolsData.length === 0) {
        return;
    }
    const tool = toolsData[0]
    let toolPath = tool["path"]
    let toolArgs = tool["args"]
    let toolType = tool["toolType"]
    const workingDirectory = typeof toolPath === 'string' ? path.dirname(toolPath) : '.';

    if (toolType == 1) {
        [toolArgs, toolPath] = paramsForPythonTool(event, toolArgs, toolPath);
        if ((!toolArgs) || (!toolPath)) {
            if (toolsData.length > 1) {
                runToolsInSerial(event, toolsData.slice(1));
                return
            } else {
                return
            }
        }
    }

    const invocation = normaliseToolInvocation(toolPath, toolArgs);
    if (!invocation) {
        log.warn('Rejected a collector launch with invalid parameters', { toolId: tool.toolId });
        if (toolsData.length > 1) {
            runToolsInSerial(event, toolsData.slice(1));
        }
        return;
    }

    const result = spawn(invocation.path, invocation.args, { env: shellEnvironments, cwd: workingDirectory })
    runningProcesses[tool.toolId] = result;

    result.stdout.on('data', (data) => {
        event.sender.send("tool-data", tool.toolId, data.toString())
    });

    result.stderr.on('data', (data) => {
        event.sender.send("tool-data-error", tool.toolId, data.toString())
    });

    result.on('error', function (err) { // needed for catching ENOENT
        log.error('Collector failed to start', { toolId: tool.toolId, error: err });
        event.sender.send("tool-data-error", tool.toolId, err)
    });

    result.on('close', (code) => {
        event.sender.send("tool-data-done", tool.toolId, code, path.dirname(invocation.path))
        delete runningProcesses[tool.toolId];
        if (toolsData.length > 1) { runToolsInSerial(event, toolsData.slice(1)) } ;
    });
}

ipcMain.handle("run-tools-serial", async (event, toolsData) => {
    import('shell-env').then(envPath => { shellEnvironments = envPath.shellEnvSync(); })
    await runToolsInSerial(event, toolsData);
})

function paramsForPythonTool(event, toolArgs, toolPath) {
    const pythonBinaryName = getPythonBinaryName()

    if (!pythonBinaryName) {
        event.sender.send("data-collection-error", "Cannot locate Python binary")
        event.sender.send("vulnerability-report-close", -1)
        return [null, null]
    }

    event.sender.send("data-collection-error", toolArgs)
    toolArgs.unshift(toolPath);
    toolPath = pythonBinaryName;
    return [toolArgs, toolPath];
}

ipcMain.handle("run-python", async (event, toolId, toolPath, toolArgs) => {
    import('shell-env').then(envPath => { shellEnvironments = envPath.shellEnvSync(); })
    const [pythonArgs, pythonPath] = paramsForPythonTool(event, toolArgs, toolPath);
    const workingDirectory = typeof toolPath === 'string' ? path.dirname(toolPath) : '.';
    if (pythonArgs && pythonPath) {
        await runTool(event, toolId, pythonPath, pythonArgs, workingDirectory);
    }
})

ipcMain.handle("kill-process", async (event, toolId) => {
    const running = runningProcesses[toolId];
    // The process can already have exited (or never started) when the analyst
    // hits stop twice; the previous code threw a TypeError in the main process.
    if (!running) {
        log.info('Stop was requested for a collector that is not running', { toolId });
        event.sender.send("tool-killed", toolId);
        return;
    }
    try {
        running.kill('SIGKILL');
    } catch (err) {
        log.error('Could not stop the collector', { toolId, error: err });
    }
    delete runningProcesses[toolId];
    event.sender.send("tool-killed", toolId);
})

ipcMain.handle("upload-sharphound-results", async (event, toolId, resultsPath, connectionProperties, clearResults) => {
    await handleSharpHoundResultsUpload(event, toolId, resultsPath, connectionProperties, clearResults);
})

ipcMain.handle("tools-finished-running", async (event) => {
    if (isCollectionOnly()) {
        app.quit();
    }
})

ipcMain.handle("add-scheduled-task", async (event, scheduleFrequency, dayOfWeek, dayOfMonth, scheduleTime) => {
    if (os.platform() != 'win32') {
        dialog.showMessageBox(mainWindow, {
            title: 'OS not supported',
            type: 'error',
            buttons: ['Dismiss'],
            message: 'Adding scheduled task is currently only supported on Windows.\n\n' +
                'The --collection-only argument can be used to manually schedule BlueHound on non-Windows hosts.',
        });
        return;
    }

    // Every parameter below arrives from the renderer, whose state can be
    // seeded by an imported or shared BlueHound configuration. They are
    // validated against an allow-list and passed as discrete argv entries, so
    // nothing here can be re-parsed by a shell.
    const args = buildScheduleTaskArgs({ scheduleFrequency, dayOfWeek, dayOfMonth, scheduleTime },
        path.resolve('.', 'BlueHound.exe'));

    if (!args) {
        log.warn('Rejected a scheduled task request with invalid parameters', { scheduleFrequency, dayOfWeek, dayOfMonth, scheduleTime });
        event.sender.send("tool-notification", 'Invalid schedule: the frequency, date or time is not a valid choice.');
        return;
    }

    log.info('Creating a scheduled collection task', { scheduleFrequency, dayOfWeek, dayOfMonth, scheduleTime });

    // No `shell: true`: schtasks.exe is resolved by the OS and the arguments
    // are passed through verbatim.
    const result = spawn("SCHTASKS", args);

    result.stderr.on('data', (data) => {
        log.error('SCHTASKS reported an error', { output: data.toString() });
    });

    result.on('error', function (err) { // needed for catching ENOENT
        log.error('Could not run SCHTASKS', err);
        event.sender.send("tool-notification", 'Failed to add the scheduled task.');
    });

    result.on('close', (code) => {
        if (code == 0) {
            event.sender.send("tool-notification", "Scheduled task added successfully.")
        } else {
            log.error('SCHTASKS exited with a non-zero status', { code });
            event.sender.send("tool-notification", 'Failed to add the scheduled task.');
        }
    });
})