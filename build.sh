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
    echo "-r --ref REF             Sets the Lite XL ref to check out."
    echo "                         Default: latest tag."
    echo "-x --xldir DIRNAME       Sets the path to Lite XL."
    echo "                         Default: 'lite-xl'."
    echo "-a --addons              Package addons as well."
    echo "-o --output OUTPUTDIR    Sets the output path."
    echo "                         Default: 'dist'."
    echo "-c --connector           Builds the connector."
    echo "   --debug               Debug this script."
    echo "-h --help                Shows this message."
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
    local connector=""

    set +u

    # shellcheck disable=SC2034
    for i in "$@"; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            -b|--builddir)
                builddir="$2"
                shift
                shift
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
            -o|--output)
                output="$2"
                shift
                shift
                ;;
            -c|--connector)
                connector="true"
                shift
                ;;
            --debug)
                set -x
                debug="--debug"
                shift
                ;;
            *)
                ;;
        esac
    done

    set -u
    
    if [[ -n "${1:-}" ]]; then
        show_help
        exit 1
    fi

    if ! command -v file_packager >/dev/null 2>&1; then
        echo "error: file_packager not found"
        exit
    fi

    # normalize dirs
    output="$PWD/$output"
    rootdir="$PWD"

    if ! [[ -d "$xldir/.git" ]]; then
        git clone "https://github.com/lite-xl/lite-xl" "$xldir"
    fi


    pushd "$xldir"
    if [[ -z "$ref" ]]; then
        ref="$(git describe --tags "$(git rev-list --tags --max-count=1)")"
    fi

    # checkout to correct version
    if ! git checkout "$ref"; then
        echo "warning: cannot check out, you are on your own"
    fi
    popd


    # compile connector, because we need the cross file
    if [[ $connector = true ]]; then
        pushd core
        if ! [[ -d "build" ]]; then
            meson setup build \
                --cross-file "$rootdir/cross/10-emcc.txt" \
                --cross-file "$rootdir/cross/25-side-module.txt"
        fi
        
        meson install -C build --destdir ../install
        popd
    fi

    # compile lite-xl
    pushd "$xldir"
    if [[ $connector = true ]] && ! cmp "$rootdir/core/install/99-exported-functions.txt" "$builddir/99-exported-functions.txt" >/dev/null 2>&1; then
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

        if [[ $connector == true ]]; then
            # TODO: fix this
            # for f in "$rootdir/core/install/"*.txt; do
            #     cross_files+=("--cross-file" "$f")
            # done
            :
        fi

        # configure
        meson setup "$builddir" -Dportable=true \
            --cross-file resources/cross/unknown-wasm32.txt \
            "${cross_files[@]}"
        
        # copy cross file over to keep track of settings
        if [[ $connector == true ]]; then
            # TODO: fix this
            # cp "$rootdir/core/install/99-exported-functions.txt" "$builddir/99-exported-functions.txt"
            :
        fi
    fi

    # package
    bash scripts/package.sh --builddir "$builddir" --addons $debug $addons

    # copy connector over
    if [[ $connector == true ]]; then
        # TODO: fix this
        cp -r "$rootdir/core/install/data/." "lite-xl/data"
        :
    fi

    # create data bundle
    # sidenote: the file extension is set to wasm to trick reverse proxies to compress it
    file_packager bundle.wasm --preload lite-xl/data@/usr/share/lite-xl \
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
