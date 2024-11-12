# /usr/bin/env python3

import os
import stat
import shutil
import hashlib
import subprocess
from pathlib import Path
from argparse import ArgumentParser, Action


def get_deps(input_path, hasher):
    """
    Walks a directory and gets the mtime of each file and directory.
    """
    # just return the path and hash if the path is actually a file
    dir_stat = Path(input_path).stat(follow_symlinks=False)
    if stat.S_ISREG(dir_stat.st_mode):
        hasher.update(input_path.encode())
        hasher.update(
            dir_stat.st_mtime_ns.to_bytes(
                (dir_stat.st_mtime_ns.bit_length() + 7) // 8, byteorder="big"
            )
        )
        yield input_path
    else:
        stack = [input_path]
        while len(stack) > 0:
            for p in os.scandir(stack.pop()):
                stat_res = p.stat(follow_symlinks=False)
                isdir = stat.S_ISDIR(stat_res.st_mode)
                path = f"{p.path}{os.path.sep}" if isdir else p.path
                hasher.update(path.encode())
                hasher.update(
                    stat_res.st_mtime_ns.to_bytes(
                        (stat_res.st_mtime_ns.bit_length() + 7) // 8, byteorder="big"
                    )
                )
                if isdir:
                    stack.append(p.path)
                else:
                    yield path


def escape_makefile(s):
    """
    Escapes the string according to cmake.
    https://cmake.org/cmake/help/latest/command/add_custom_command.html#grammar-token-depfile-pathname
    """
    return (
        s.replace("$", "$$")
        .replace("#", "\\#")
        .replace(" ", "\\ ")
        .replace("\t", "\\\t")
    )


def copy_file(dest, src, src_prefix):
    """
    Copy a file from src to dest, relative to src_prefix.
    """
    rel_path = src.relative_to(src_prefix)
    dest_path = dest / rel_path
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest_path)
    return dest_path


class PrefixedInputAction(Action):
    def __call__(self, parser, namespace, values, option_string=None):
        option_string = option_string.strip("-").replace("-", "_")
        inc_paths = getattr(namespace, option_string) or dict()
        inc_paths[values[0]] = [values[0]] if len(values) == 1 else values[1:]
        setattr(namespace, option_string, inc_paths)


def main():
    parser = ArgumentParser()
    parser.add_argument(
        "--bundle-dat", required=True, help="The name of the bundle data file"
    )
    parser.add_argument(
        "--bundle-js", required=True, help="The name of the bundle JS file"
    )
    parser.add_argument(
        "--depfile", required=True, help="Path for the generated depfile"
    )
    parser.add_argument(
        "--metafile",
        required=True,
        help="Path to store the metadata of the dependencies",
    )
    parser.add_argument("--plugins", nargs="*", help="Plugins to install via lpm")
    parser.add_argument("--start-lua", required=True, help="Path to start.lua")
    parser.add_argument(
        "--prefix", required=True, help="Prefix of the files added to bundle"
    )
    parser.add_argument(
        "--include-path",
        required=True,
        nargs="+",
        help="Path to include",
        action=PrefixedInputAction,
    )

    args = parser.parse_args()

    # prepare working directory
    work_dir = Path("wasm-bundle")
    dest_dir = work_dir / args.prefix.lstrip("/\\")
    shutil.rmtree(dest_dir, ignore_errors=True)
    dest_dir.mkdir(parents=True)

    # get all files
    hasher = hashlib.sha256()
    input_files = {}
    for prefix, dirs in args.include_path.items():
        s = input_files.get(prefix, set())
        for dir in dirs:
            s.update(get_deps(dir, hasher))
        input_files[prefix] = s

    digest = hasher.digest()

    bundle_dat = args.bundle_dat
    bundle_js = args.bundle_js
    # copy the file to make the directory structure
    packager_args = [
        "file_packager",
        bundle_dat,
        "--no-force",
        "--no-node",
        "--use-preload-cache",
        "--use-preload-plugins",
    ]

    # copy files to destination
    for prefix, files in input_files.items():
        prefix = Path(prefix)
        for path in files:
            path = Path(path)
            # skip this file, we will add it later
            if path.match("data/core/start.lua"):
                continue
            dest_path = copy_file(dest_dir, path, prefix)
            packager_args.extend(
                ["--preload", f"{str(path)}@/{str(dest_path.relative_to(work_dir))}"]
            )

    # add start.lua
    packager_args.extend(
        [
            "--preload",
            f"{args.start_lua}@/{str(dest_dir.relative_to(work_dir) / 'core/start.lua')}",
        ]
    )

    # run file_packager and capture the js output, and then wrap it
    proc = subprocess.run(packager_args, capture_output=True, text=True)
    with open(bundle_js, "w") as js_file:
        js_file.write("module.exports = (Module) => {")
        js_file.write(proc.stdout)
        js_file.write("; return Module; };")

    # check if the depfile is updated
    try:
        with open(args.metafile, "r") as metafile:
            sha = metafile.readline().strip()
            if sha != digest:
                raise ValueError("digest mismatch")
    except:
        # write the new depfile
        with open(args.depfile, "w") as depfile:
            depfile.write(
                f"{escape_makefile(args.bundle_js)} {escape_makefile(args.bundle_dat)}:\n"
            )
            for p in input_files:
                depfile.write(escape_makefile(p))
                depfile.write(" \\\n")

        # update metafile
        with open(args.metafile, "w") as metafile:
            metafile.write(f"{digest}")


if __name__ == "__main__":
    main()
