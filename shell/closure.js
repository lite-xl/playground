const { join } = require("path");
const { exit, argv } = require("process");
const { readdirSync } = require("fs");
const ClosureCompiler = require("google-closure-compiler");

const [outputFile, entrypoint, ...inputFiles] = argv.slice(2);

// get the externs for closure compiler
const externs = readdirSync(join(__dirname, "closure"))
  .filter((x) => x.endsWith("js"))
  .map((x) => join(__dirname, "closure", x));

// compile with closure compiler
const closure = new ClosureCompiler.compiler({
  entry_point: entrypoint,
  js: [entrypoint, ...inputFiles],
  compilation_level: "ADVANCED",
  language_out: "ECMASCRIPT_2017",
  js_output_file: outputFile,
  emit_use_strict: false,
  externs,
});

// run the compiler
closure.run((exitCode, stdout, stderr) => {
  // write a dummy C file so that the output can be linked
  console.log(stdout);
  console.log(stderr);
  exit(exitCode);
});
