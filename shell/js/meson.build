custom_target('main.js',
                input: ['main.js', lite_exe],
                output: 'main.js',
                build_by_default: true,
                depend_files: [package_lock, esbuild_script],
                install: true,
                install_dir: lite_bindir,
                # esbuild only needs the entrypoint to figure out what files to bundle
                command: [node_exe, esbuild_script , '@OUTPUT@', 'true', '@INPUT@'])

custom_target('advanced.js',
                input: 'advanced.js',
                output: 'advanced.js',
                build_by_default: true,
                depend_files: [package_lock, esbuild_script],
                install: true,
                install_dir: lite_bindir,
                # esbuild only needs the entrypoint to figure out what files to bundle
                command: [node_exe, esbuild_script, '@OUTPUT@', 'true', '@INPUT0@'])