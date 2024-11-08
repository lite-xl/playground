custom_target(
    'main.js',
    input: [lite_exe, 'main.js'],
    output: 'main.js',
    build_by_default: true,
    depend_files: [package_lock, esbuild_concat_script, node_modules_dep],
    install: true,
    install_dir: lite_bindir,
    # the first must be the entrypoint
    command: [node_exe, esbuild_concat_script, '@OUTPUT@', 'entrypoint', 'true', '@INPUT@']
)

custom_target(
    'advanced.js',
    input: 'advanced.js',
    output: 'advanced.js',
    depend_files: [package_lock, esbuild_script, node_modules_dep],
    build_by_default: true,
    install: true,
    install_dir: lite_bindir,
    # esbuild only needs the entrypoint to figure out what files to bundle
    command: [node_exe, esbuild_script, '@OUTPUT@', 'true', '@INPUT0@'],
)