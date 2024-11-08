css_src = [
    'advanced.css',
    'main.css',
]

foreach css: css_src
    custom_target(css,
                    input: css,
                    output: css,
                    depends: [esbuild_dep],
                    depend_files: [package_lock, 'theme.css'],
                    install: true,
                    install_dir: lite_bindir / 'css',
                    command: [
                        esbuild_exe,
                        '--bundle',
                        '@INPUT@', '--outfile=@OUTPUT@',
                    ])
endforeach