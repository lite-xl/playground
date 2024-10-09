#!/bin/bash

set -e

if [ ! -e "src/api/api.h" ]; then
  echo "Please run this script from the root directory of Lite XL."; exit 1
fi

source scripts/common.sh

# find file packager to package the data dirs
file_packager="file_packager"
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
    file_packager="$(readlink -f "$(dirname "${emcc_abs_path}")/tools/file_packager")"
fi

build_dir=$(get_default_build_dir "emscripten" "wasm32")
dest_dir=github-pages

# install node deps
if ! [[ -d shell/node_modules ]]; then
  pushd shell
  npm ci
  popd
fi

if [[ ! -d "$build_dir" ]]; then
    meson setup "$build_dir" --cross-file resources/cross/unknown-wasm32.txt -Dwasm_preload_files=false
fi

meson compile -C "$build_dir"

rm -rf "${dest_dir}"
DESTDIR="$(pwd)/${dest_dir}" meson install --skip-subprojects -C "${build_dir}"

data_dir="$(pwd)/${dest_dir}/data"
mkdir -p "${data_dir}"
addons_download "${build_dir}"
addons_install "${build_dir}" "${data_dir}"

echo "Creating a portable, compressed archive..."
# the name is wasm to trick reverse proxies into compressing them
$file_packager "${dest_dir}/lite-xl-files.json" \
    --preload "${dest_dir}/data@/usr/share/lite-xl" \
    --preload "${dest_dir}/doc/licenses.md@/usr/share/licenses/lite-xl/licenses.md" \
    --preload "welcome.md@/usr/share/lite-xl/welcome.md" \
    --no-force --no-node --use-preload-cache --use-preload-plugins \
    --quiet --js-output="${dest_dir}/lite-xl-files.js"
# this file is rather big, run closure compiler over the output
node shell/closure.js "${dest_dir}/lite-xl-files.min.js" "${dest_dir}/lite-xl-files.js"
# these files can be removed for final distribution
rm -rf "$(pwd)/${dest_dir}/lite-xl.js" "$(pwd)/${dest_dir}/lite-xl-files.js" \
        "${data_dir}" "$(pwd)/${dest_dir}/doc"
