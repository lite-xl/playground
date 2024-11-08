const { argv } = require("process");
const { readFileSync, writeFileSync } = require("fs");
const { buildSync } = require("esbuild");

const [output, ...files] = argv.slice(2);

buildSync({
    outfile: output,
    minify: true,
    bundle: true,
    logLevel: 'info',
    stdin: { contents: files.filter(f => f.endsWith('.js')).map(f => readFileSync(f, { encoding: 'utf-8' })).join('\n') }
});