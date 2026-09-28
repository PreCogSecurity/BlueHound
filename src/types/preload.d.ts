/**
 * Type declarations for the preload bridge.
 *
 * This file used to live at the repository root, outside the tsconfig
 * `include`, so it was never part of the compilation and every
 * `window.electron.*` call in the renderer was an untyped error. It is now
 * inside `src/` and matches the API that `src/preload.js` actually exposes.
 *
 * The bridge is the only way the renderer can reach the main process: the
 * renderer runs with `nodeIntegration` off, `contextIsolation` on and
 * `sandbox` on. Keep this list in sync with `src/preload.js`.
 */
export {};

declare global {
    interface BlueHoundBridge {
        appLoaded(): Promise<unknown>;
        openDevTools(): Promise<unknown>;
        getConsoleMessages(): Promise<unknown>;
        browseFile(index: unknown): Promise<unknown>;
        browseFolder(index: unknown): Promise<unknown>;
        runTool(toolId: unknown, path: unknown, args: unknown): Promise<unknown>;
        runToolsInSerial(toolsData: unknown): Promise<unknown>;
        runPython(toolId: unknown, path: unknown, args: unknown): Promise<unknown>;
        uploadSharpHoundResults(
            toolId: unknown,
            path: unknown,
            connectionProperties: unknown,
            clearResults: unknown
        ): Promise<unknown>;
        killProcess(toolId: unknown): Promise<unknown>;
        toolsFinishedRunning(): Promise<unknown>;
        addScheduledTask(
            scheduleFrequency: unknown,
            dayOfWeek: unknown,
            dayOfMonth: unknown,
            scheduleTime: unknown
        ): Promise<unknown>;
        send(channel: string, data?: unknown): void;
        receive(channel: string, func: (...args: any[]) => void): void;
    }

    interface Window {
        electron?: BlueHoundBridge;
    }
}
