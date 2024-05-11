# Lite XL Playground

This repository contains files needed to run Lite XL in the browser.
Lite XL includes a shell file that does the job pretty well,
but the aim here is to improve the experience more by making it actually
useful.

## Instructions

This repository is still a work-in-progress, so detailed instructions on how
to set up everything is not available.

In general, you will need the following tools:

- Emscripten (optionally emsdk) 3.1.57 and newer. Older versions will not work.
- wasm-dis (Installed with Emscripten if emsdk is used)
- file_packager (Installed with Emscripten if emsdk is used)
- watchexec (Optional)
- A HTTP Server (I use `http-server`, but Python's `http.server` will work with caveats.)
- Git
- Bash (MSYS2 might work but not tested)
- npm (Optional, for prettifying source code)

Your entry point will be `build.sh`, which can be used to build and deploy the application.
For most people, running `./build.sh` will be sufficient,
or you could run `./build.sh -w` to automatically build the project when a file is changed.

The generated file are available in `dist`.

You can find specific documentation in each subfolder.