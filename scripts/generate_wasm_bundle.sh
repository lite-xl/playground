#!/usr/bin/env bash

show_help() {
  echo
  echo "Usage: $0 <OPTIONS>"
  echo
  echo "Available options:"
  echo
  echo "-p PREFIX  Remove this prefix from the input."
  echo "-i DIR     Include this directory."
  echo "-e FILE    Exclude this file."
  echo "-j JS      JS output path."
  echo "-d DATA    Data output path."
  echo "-h         Shows this message."
  echo "--debug    Show debug information."
  echo
}


prefix=""
output_dat_path=""
output_js_path=""
declare -a include_dirs
declare -a exclude_files

for i in "$@"; do
  case $i in
    -h)
      show_help
      exit 0
      ;;
    -i)
      include_dirs+=("$2")
      shift
      shift
      ;;
    -e)
      exclude_dirs+=("$2")
      shift
      shift
      ;;
    -j)
      output_js_path="$2"
      shift
      shift
      ;;
    -d)
      output_dat_path="$2"
      shift
      shift
      ;;
    -p)
      prefix="$2"
      shift
      shift
      ;;
    --debug)
      set -x
      shift
      ;;
    *)
      # unknown option
      ;;
  esac
done

if [[ -n $1 ]]; then
  show_help
  exit 1
fi

# let's add this back until lpm starts working again
addons_download() {
  local build_dir="$1"
  if [[ -d "${build_dir}/third/data/colors" ]]; then
    echo "Warning: found previous addons installation, skipping."
    echo "  addons path: ${build_dir}/third/data/colors"
    return 0
  fi
  # Download third party color themes
  curl --insecure \
    -L "https://github.com/lite-xl/lite-xl-colors/archive/master.zip" \
    -o "${build_dir}/lite-xl-colors.zip"
  mkdir -p "${build_dir}/third/data/colors"
  unzip "${build_dir}/lite-xl-colors.zip" -d "${build_dir}"
  mv "${build_dir}/lite-xl-colors-master/colors" "${build_dir}/third/data"
  rm -rf "${build_dir}/lite-xl-colors-master"
  # Download widgets library
  curl --insecure \
    -L "https://github.com/lite-xl/lite-xl-widgets/archive/master.zip" \
    -o "${build_dir}/lite-xl-widgets.zip"
  unzip "${build_dir}/lite-xl-widgets.zip" -d "${build_dir}"
  mkdir -p "${build_dir}/third/data/libraries"
  mv "${build_dir}/lite-xl-widgets-master" "${build_dir}/third/data/libraries/widget"
  # Downlaod thirdparty plugins
  curl --insecure \
    -L "https://github.com/lite-xl/lite-xl-plugins/archive/master.zip" \
    -o "${build_dir}/lite-xl-plugins.zip"
  unzip "${build_dir}/lite-xl-plugins.zip" -d "${build_dir}"
  mv "${build_dir}/lite-xl-plugins-master/plugins" "${build_dir}/third/data"
  rm -rf "${build_dir}/lite-xl-plugins-master"
}
# Addons installation: some distributions forbid external downloads
# so make it as optional module.
addons_install() {
  local build_dir="$1"
  local data_dir="$2"
  for module_name in colors libraries; do
    cp -r "${build_dir}/third/data/$module_name" "${data_dir}"
  done
  mkdir -p "${data_dir}/plugins"
  for plugin_name in settings open_ext; do
    cp -r "${build_dir}/third/data/plugins/${plugin_name}.lua" \
      "${data_dir}/plugins/"
  done
  cp "${build_dir}/third/data/plugins/"language_* \
      "${data_dir}/plugins/"
}

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

data_dir="wasm-bundle/usr/share/lite-xl"
build_dir="wasm-bundle/build"

rm -rf "${data_dir}"
rm -rf "${build_dir}"
mkdir -p "${build_dir}"
mkdir -p "${data_dir}"

declare -a exclude_args

for d in "${exclude_dirs[@]}"; do
  exclude_args+=("--exclude" "$d")
done

for d in "${include_dirs[@]}"; do
  src_dir="${d%%@*}"
  dst_dir="${d##*@}"
  if [[ -d "${src_dir}" ]]; then
    rsync -ah "${src_dir}/" "${data_dir}/${dst_dir}" "${exclude_args[@]}"
  else
    # fixme: bypasses exclude_dirs
    mkdir -p "${data_dir}/$(dirname "$dst_dir")"
    cp -a "${src_dir}" "${data_dir}/${dst_dir}"
  fi
done

addons_download "${build_dir}"
addons_install "${build_dir}" "${data_dir}"

$file_packager "${output_dat_path}" \
    --preload "${data_dir}@/usr/share/lite-xl" \
    --no-force --no-node --use-preload-cache --use-preload-plugins \
    --quiet --js-output="${output_js_path}"