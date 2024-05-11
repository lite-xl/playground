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
    echo "-w --watch               Uses watchexec to build if a file had changed."
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
    echo "-C --no-connector        Do not build the connector."
    echo "-P --no-plugins          Do not install extra plugins for better web browser integration."
    echo "-W --no-wasm-core        Do not install extra hooks."
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
    local watch=""
    
    local connector="enabled"
    local extra_plugins="enabled"
    local wasm_core="enabled"

    local ORIGINAL_ARGS=("$@")

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

            -w|--watch)
                watch="true"
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

            -C|--no-connector)
                connector="disabled"
                shift
                ;;

            -P|--no-plugins)
                extra_plugins="disabled"
                shift
                ;;

            -W|--no-wasm-core)
                wasm_core="disabled"
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
        if ! type -p emsdk >/dev/null; then
            echo "error: cannot find emsdk"
            exit 1
        fi
        # shellcheck source=/dev/null
        source <(EMSDK_QUIET=1 emsdk construct_env)
        # shellcheck disable=SC2155
        local emcc_path="$(dirname "$(type -p emcc)")"
        if ! type -p file_packager >/dev/null; then
            # file_packager is inside emscripten/tools
            # shellcheck disable=SC2155
            export PATH="$(readlink -e "$emcc_path/tools"):$PATH"
        fi
        if ! type -p wasm-dis >/dev/null; then
            # wasm-dis is inside emscripten/../bin
            # shellcheck disable=SC2155
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

    if [[ $watch = "true" ]] && [[ -z ${BUILD_SH_WATCH_CHILD-} ]]; then
        exec env BUILD_SH_WATCH_CHILD=1 watchexec -w core -w cross -w shell -w lite-xl -w welcome.md -w build.sh $BASH_SOURCE "${ORIGINAL_ARGS[@]}"
    fi

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
    # generate a list of cross files, and check if lite-xl build directory is using an outdated version
    declare -a cross_files
    for f in "$rootdir/cross/"*.txt; do
        cross_files+=("$f")
    done
    if [[ $connector = enabled ]]; then
        for f in "$rootdir/core/install/"*.txt; do
            cross_files+=("$f")
        done
    fi
    md5sum "${cross_files[@]}" > "cross-files-checksums"

    if [[ -d "$builddir" ]] && ! cmp "cross-files-checksums" "$builddir/cross-files-checksums" >/dev/null 2>&1; then
        # cross file changed, delete it
        rm -rf "$builddir"
    fi

    if ! [[ -d "$builddir" ]]; then
        # get a list of cross files
        declare -a cross_files_args

        for f in "${cross_files[@]}"; do
            cross_files_args+=("--cross-file" "$f")
        done

        # configure
        meson setup "$builddir" --reconfigure -Dportable=true \
            --cross-file resources/cross/unknown-wasm32.txt \
            "${cross_files_args[@]}"
        
        # copy the cross file checksums over to keep track of it
        cp cross-files-checksums "$builddir/cross-files-checksums"
    fi

    # package
    bash scripts/package.sh --builddir "$builddir" --addons $debug $addons

    # remove the workspace plugin because we have our own?
    if [[ -e "lite-xl/data/plugins/workspace.lua" ]]; then
        rm "lite-xl/data/plugins/workspace.lua"
    fi

    # copy core over
    if [[ $connector = enabled ]] || [[ $extra_plugins == enabled ]] || [[ $wasm_core == enabled ]]; then
        cp -r "$rootdir/core/install/data/." "lite-xl/data"
    fi

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
    cp -r "$rootdir/shell/css" "$rootdir/shell/js" "$rootdir/shell/"*.html "$output"
    cp "lite-xl/lite-xl.js" "lite-xl/lite-xl.wasm" "$output"
    cp bundle.wasm.js bundle.wasm "$output"
}

main "$@"
