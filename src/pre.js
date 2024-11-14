// set the program name (without this lite-xl will crash)
Module.thisProgram = '/usr/bin/lite-xl';

// will be converted by esbuild into a correct import (do not convert this into ES6 import)
const { uploadFiles, downloadFiles, PromiseRegistry } = require('wasm-interop');