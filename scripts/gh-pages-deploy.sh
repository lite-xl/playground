#!/bin/bash

set -e

if [ ! -e "src/api/api.h" ]; then
  echo "Please run this script from the root directory of Lite XL."; exit 1
fi

# find file packager to package the data dirs
if ! command -v file_packager >/dev/null 2>&1; then
    if ! command -v emcc >/dev/null 2>&1; then
        if command -v emsdk >/dev/null 2>&1; then
            # this is running under bash, unless someone messes with the shebang
            source <(EMSDK_BASH=1 emsdk construct_env)
        else
            echo "error: cannot find file_packager"
            exit 1
        fi
    fi
    # find file_packager by using emcc
    emcc_abs_path="$(readlink -f "$(command -v emcc)")"
    export PATH="$(readlink -f "$(dirname "${emcc_abs_path}")/tools"):$PATH"
fi

build_dir="build-wasm32-emscripten"
dest_dir=github-pages

if [[ ! -d "$build_dir" ]]; then
    args=(
        '-Dwasm_preload_files=false'
        '-Dwasm_build_bundle=true'
    )
    if [[ "$PRODUCTION" = "true" ]]; then
        args+=('-Dwasm_debug=sourcemap')
    else
        args+=('-Dwasm_debug=dwarf')
    fi
    meson setup "$build_dir" --cross-file resources/cross/unknown-wasm32.txt "${args[@]}"
fi

ninja -C "$build_dir" $1

if [[ -z "$1" ]]; then
    if [ -d "${dest_dir}" ]; then
        find "${dest_dir}" -mindepth 1 -delete
    fi
    DESTDIR="$(pwd)/${dest_dir}" meson install --no-rebuild --skip-subprojects --tags shell,bundle,exe,sourcemap -C "${build_dir}"
rm -f "${dest_dir}/lite-xl.js"
fi