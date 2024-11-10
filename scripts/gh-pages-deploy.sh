#!/bin/bash

set -e

if [ ! -e "src/api/api.h" ]; then
  echo "Please run this script from the root directory of Lite XL."; exit 1
fi

source scripts/common.sh

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

build_dir=$(get_default_build_dir "emscripten" "wasm32")
dest_dir=github-pages

if [[ ! -d "$build_dir" ]]; then
    meson setup "$build_dir" --cross-file resources/cross/unknown-wasm32.txt -Dwasm_preload_files=false -Dwasm_build_bundle=true
fi

meson compile -C "$build_dir"

if [ -d "${dest_dir}" ]; then
    find "${dest_dir}" -mindepth 1 -delete
fi
DESTDIR="$(pwd)/${dest_dir}" meson install --no-rebuild --skip-subprojects --tags shell,bundle,exe -C "${build_dir}"

rm -f "${dest_dir}/lite-xl.js"