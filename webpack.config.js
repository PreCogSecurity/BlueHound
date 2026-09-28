const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

/**
 * Loads a local `.env` file (see `.env.example`) without pulling in a
 * dependency. Real environment variables always win, and nothing is injected
 * into the bundle: only the values listed here are ever read, so a stray
 * NEO4J_PASSWORD in the environment can never end up in the shipped JavaScript.
 */
const loadLocalEnv = () => {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        return {};
    }
    const loaded = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/.exec(line);
        if (!match || line.trim().startsWith('#')) {
            continue;
        }
        loaded[match[1]] = (match[2] || '').replace(/^["']|["']$/g, '');
    }
    return loaded;
};

const localEnv = loadLocalEnv();
const env = (name, fallback) => process.env[name] ?? localEnv[name] ?? fallback;

module.exports = {
    entry: './src/index.tsx',
    //target: 'electron-renderer',
    //devtool: 'source-map',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.(js|jsx|tsx)$/,
                exclude: /(node_modules)/,
                loader: 'babel-loader',
                options: { presets: ["@babel/env"] }
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.js$/,
                enforce: 'pre',
                use: ['source-map-loader'],
            },
            {
                test: /.(png|svg|jpe?g|gif|woff2?|ttf|eot)$/,
                use: ['file-loader']
            },
            {
                test: /\.ts$/,
                include: /src/,
                use: [{ loader: 'ts-loader' }]
            }
        ]
    },
    resolve: { extensions: ['*', '.js', '.jsx', '.ts', '.tsx'] },
    output: {
        filename: 'bundle.js',
        publicPath: '',
    },
    devServer: {
        host: env('BLUEHOUND_DEV_HOST', 'localhost'),
        port: Number(env('BLUEHOUND_DEV_PORT', '3000')),
        hot: true
    },
    plugins: [new webpack.HotModuleReplacementPlugin()]
};
