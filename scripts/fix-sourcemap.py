#!/usr/bin/env python3

import json
from argparse import ArgumentParser, FileType


def main():
    parser = ArgumentParser()
    parser.add_argument(
        "sourcemap",
        type=FileType("r+", encoding="utf-8"),
        help="The sourcemap to modify",
    )
    parser.add_argument("base_url", help="The sourceRoot URL")
    args = parser.parse_args()

    content = json.load(args.sourcemap)
    if content["version"] < 3:
        raise ValueError("Sourcemap version 2 and lower is not supported")
    content["sourceRoot"] = args.base_url
    args.sourcemap.seek(0)
    json.dump(content, args.sourcemap)


if __name__ == "__main__":
    main()
