node_exe = find_program('node')

closure_externs = [
    meson.current_source_dir() / 'closure/closure-externs.js',
    meson.current_source_dir() / 'closure/dyncall-externs.js',
    meson.current_source_dir() / 'closure/modularize-externs.js',
    meson.current_source_dir() / 'closure/module-externs.js',
]

package_lock = meson.current_source_dir() / 'package-lock.json'
closure_script = meson.current_source_dir() / 'closure.js'
esbuild_script = meson.current_source_dir() / 'esbuild.js'

subdir('js')
subdir('css')
subdir('html')

install_data('favicon.png',
                install_dir: lite_bindir)

