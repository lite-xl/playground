css_src = [
    'advanced.css',
    'main.css',
]

foreach css: css_src
    custom_target(css,
                    input: css,
                    output: css,
                    depend_files: ['theme.css'],
                    install: true,
                    install_dir: lite_bindir / 'css',
                    install_tag: ['shell'],
                    command: [
                        esbuild_exe,
                        '--bundle',
                        '--minify',
                        '@INPUT@', '--outfile=@OUTPUT@',
                        '--sourcemap=linked',
                    ])
endforeach