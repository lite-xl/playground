#!/usr/bin/env bash

# Compiles Lite XL for wasm and builds the website or something.

set -euo pipefail
IFS=$'\n\t'

if ! [[ -f "shell/index.html" ]]; then
    echo "Please run this script from the root directory of the repository."
    exit 1
fi

show_help() {
    echo
    echo "Create WASM builds that can be ran in a browser."
    echo "Usage: $0 <OPTIONS>"
    echo
    echo "Available options:"
    echo
    echo "-b --builddir DIRNAME    Sets the name of the build directory."
    echo "                         Default: 'build'."
    echo "-o --output OUTPUTDIR    Sets the output path."
    echo "                         Default: 'dist'."
    echo "   --debug               Debug this script."
    echo "-h --help                Shows this message."
    echo
    echo "Lite XL options:"
    echo "-r --ref REF             Sets the Lite XL ref to check out."
    echo "                         Default: latest tag."
    echo "-x --xldir DIRNAME       Sets the path to Lite XL."
    echo "                         Default: 'lite-xl'."
    echo "-a --addons              Package addons as well."
    echo
    echo "Plugins options:"
    echo "-c --connector           Builds the connector."
    echo "-p --plugins             Installs the plugins for better web browser integration."
    echo "-w --wasm-core           Installs extra hooks."
    echo
}

main() {
    local builddir="build"
    local rootdir="$PWD"
    local output="dist"
    local xldir="lite-xl"
    local addons=""
    local debug=""
    local ref=""
    
    local connector="disabled"
    local extra_plugins="disabled"
    local wasm_core="disabled"

    while [[ $# -gt 0 ]]; do
        case "$1" in

            -b|--builddir)
                builddir="$2"
                shift
                shift
                ;;
            -o|--output)
                output="$2"
                shift
                shift
                ;;
            --debug)
                set -x
                debug="--debug"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;

            -r|--ref)
                ref="$2"
                shift
                shift
                ;;
            -x|--xldir)
                xldir="$2"
                shift
                shift
                ;;
            -a|--addons)
                addons="--addons"
                shift
                ;;

            -c|--connector)
                connector="enabled"
                shift
                ;;
            -p|--plugins)
                extra_plugins="enabled"
                shift
                ;;
            -w|--wasm-core)
                wasm_core="enabled"
                shift
                ;;

            *)
                ;;
        esac
    done

    if [[ -n "${1:-}" ]]; then
        show_help
        exit 1
    fi

    # check if emcc, wasm-dis and file_packager is found.
    # if not, try to get it from emsdk
    if ! type -p emcc >/dev/null || ! type -p file_packager >/dev/null || ! type -p wasm-dis >/dev/null; then
        echo "emcc and tools not found, sourcing from emsdk"
        if ! type -p emsdk; then
            echo "error: cannot find emsdk"
            exit 1
        fi
        source <(EMSDK_QUIET=1 emsdk construct_env)
        local emcc_path="$(dirname "$(type -p emcc)")"
        if ! type -p file_packager >/dev/null; then
            # file_packager is inside emscripten/tools
            export PATH="$(readlink -e "$emcc_path/tools"):$PATH"
        fi
        if ! type -p wasm-dis >/dev/null; then
            # wasm-dis is inside emscripten/../bin
            export PATH="$(readlink -e "$emcc_path/../bin"):$PATH"
        fi
    fi

    if ! type -p file_packager >/dev/null; then
        echo "error: file_packager not found"
        exit
    fi

    if ! type -p wasm-dis >/dev/null; then
        echo "error: wasm-dis not found"
        exit
    fi

    # normalize dirs
    output="$PWD/$output"
    rootdir="$PWD"

    if ! [[ -d "$xldir/.git" ]]; then
        git clone "https://github.com/lite-xl/lite-xl" "$xldir"
    fi


    # checkout lite-xl to correct version
    pushd "$xldir"
    if [[ -z "$ref" ]]; then
        ref="$(git describe --tags "$(git rev-list --tags --max-count=1)")"
    fi

    if ! git checkout "$ref"; then
        echo "warning: cannot check out, you are on your own"
    fi
    popd

    pushd core
    meson setup build --reconfigure \
        -Dconnector=$connector \
        -Dplugins=$extra_plugins \
        -Dwasm_core=$wasm_core \
        --cross-file "$rootdir/cross/10-emcc.txt" \
        --cross-file "$rootdir/cross/25-side-module.txt"

    if [[ -d install ]]; then
        rm -r install
    fi
    meson install -C build --destdir ../install
    popd

    # compile lite-xl
    pushd "$xldir"
    if [[ $connector = enabled ]] && ! cmp "$rootdir/core/install/99-exported-functions.txt" "$builddir/99-exported-functions.txt" >/dev/null 2>&1; then
        if [[ -d "$builddir" ]]; then
            # different cross file, rebuild
            rm -rf "$builddir"
        fi
    fi

    if ! [[ -d "$builddir" ]]; then
        # get a list of cross files
        declare -a cross_files

        for f in "$rootdir/cross/"*.txt; do
            cross_files+=("--cross-file" "$f")
        done

        if [[ $connector = enabled ]]; then
            for f in "$rootdir/core/install/"*.txt; do
                cross_files+=("--cross-file" "$f")
            done
        fi

        # configure
        meson setup "$builddir" -Dportable=true \
            --cross-file resources/cross/unknown-wasm32.txt \
            "${cross_files[@]}"
        
        # copy cross file over to keep track of settings
        if [[ $connector ==  enabled ]]; then
            cp "$rootdir/core/install/99-exported-functions.txt" "$builddir/99-exported-functions.txt"
        fi
    fi

    # package
    bash scripts/package.sh --builddir "$builddir" --addons $debug $addons

    # copy core over
    cp -r "$rootdir/core/install/data/." "lite-xl/data"

    # create data bundle
    # sidenote: the file extension is set to wasm to trick reverse proxies to compress it
    file_packager bundle.wasm --preload lite-xl/data@/usr/share/lite-xl \
        --preload "$rootdir/welcome.md@/usr/share/lite-xl/welcome.md" \
        --js-output=bundle.wasm.js --use-preload-cache --no-node --no-force \
        --use-preload-plugins --quiet

    # create the distribution
    if [[ -d "$output" ]]; then
        rm -r "$output"
    fi
    mkdir "$output"

    # copy all the files
    cp -r "$rootdir/shell/." "$output"
    cp "lite-xl/lite-xl.js" "lite-xl/lite-xl.wasm" "$output"
    cp bundle.wasm.js bundle.wasm "$output"
}

main "$@"
