const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
module.exports = {
    target: 'node', // Important for VS Code extensions
    mode: 'production', // 'development' or 'production'
    entry: {
        extension: './extension.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'nosources-source-map',
    externals: {
        'vscode': 'commonjs vscode', // Exclude vscode API
        'puppeteer-core': 'commonjs puppeteer-core', // Check if we want to bundle or not. Usually safer to exclude complex libs if we pack node_modules.
        // However, if we exclude it, we MUST 'npm install' inside the final folder or let vsce do it.
        // For "Zero Config" portable, ideally we bundle. existing native modules (ws) might be an issue.
        // Let's TRY bundling puppeteer-core (it is mostly JS).
        // Native modules: 'ws' has native addons.
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
    },
    resolve: {
        extensions: ['.ts', '.js'],
        mainFields: ['module', 'main']
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: []
            }
        ]
    },
    plugins: [
        new webpack.IgnorePlugin({ resourceRegExp: /^ws$/ }) // ws optional peer deps
    ]
};
