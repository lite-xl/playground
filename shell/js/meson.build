custom_target(
    'main.js',
    input: [file_bundle[0], lite_exe, 'main.js'],
    output: ['main.js', 'main.js.map'],
    depends: [esbuild_dep],
    depend_files: [package_lock],
    install: true,
    install_dir: lite_bindir,
    command: [
        amalgamate_exe,
        '@OUTPUT0@',
        '@INPUT0@',
        '@INPUT2@',
        '@INPUT3@',
    ],
)

custom_target(
    'advanced.js',
    input: 'advanced.js',
    output: 'advanced.js',
    depends: [esbuild_dep],
    depend_files: [package_lock],
    build_by_default: true,
    install: true,
    install_dir: lite_bindir,
    # esbuild only needs the entrypoint to figure out what files to bundle
    command: [
        esbuild_exe,
        '--bundle',
        '--minify', '@INPUT0@',
        '--outfile=@OUTPUT@',
    ],
)