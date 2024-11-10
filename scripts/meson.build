if host_machine.system() == 'windows'
    configure_file(
        input : 'innosetup/innosetup.iss.in',
        output : 'innosetup.iss',
        configuration : conf_data
    )
elif host_machine.system() == 'emscripten'
    python_exe = find_program('python3', 'python')
    wasm_bundler_exe = [python_exe, meson.current_source_dir() / 'generate-wasm-bundle.py']
endif

