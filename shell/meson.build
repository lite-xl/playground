node_exe = find_program('node')

package_lock = meson.current_source_dir() / 'package-lock.json'
esbuild_script = meson.current_source_dir() / 'esbuild.js'
esbuild_concat_script = meson.current_source_dir() / 'esbuild-concat.js'

node_modules_dep = [
    meson.current_source_dir() / 'node_modules/esbuild/package.json',
]

subdir('js')
subdir('css')
subdir('html')

install_data('favicon.png',
                install_dir: lite_bindir)
