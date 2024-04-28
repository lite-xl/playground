project('wasm_core', 'c')

if get_option('connector').allowed()
    connector = shared_module('connector', 'connector.c',
                                name_prefix: '',
                                install: true,
                                install_dir: '/data/libraries')

    custom_target('connector_imports',
                    input: connector,
                    output: '99-exported-functions.txt',
                    command: ['get-imports.sh', '@OUTPUT@', '@INPUT@'],
                    depends: [connector],
                    install: true,
                    install_dir: '/')
endif

if get_option('wasm_core').allowed()
    install_data('wasm_core.lua',
                install_dir: '/data/core')
endif

if get_option('plugins').allowed()
    install_subdir('plugins',
                    install_dir: '/data')
endif
