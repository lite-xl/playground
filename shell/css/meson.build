css_src = [
    'advanced.css',
    'main.css',
]

foreach css: css_src
    custom_target(css,
                    input: css,
                    output: css,
                    depend_files: ['theme.css', '../package-lock.json', '../esbuild.js'],
                    install: true,
                    install_dir: lite_bindir / 'css',
                    # esbuild only needs the entrypoint to figure out what files to bundle
                    command: [node_exe, esbuild_script, '@OUTPUT@', 'true', '@INPUT0@'])
endforeach