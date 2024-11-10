npm_exe = find_program('npm')
node_exe = find_program('node')
esbuild_exe = [npm_exe, '--prefix', meson.current_source_dir(), 'exec', '-y', '--', 'esbuild']
amalgamate_exe = [node_exe, meson.current_source_dir() / 'amalgamate.js']

package_lock = meson.current_source_dir() / 'package-lock.json'

esbuild_dep = custom_target(
    'esbuild',
    input: 'package.json',
    output: 'node_modules',
    command: [npm_exe, '--prefix', meson.current_source_dir(), 'i']
)

subdir('js')
subdir('css')
subdir('html')

install_data('favicon.png',
                install_dir: lite_bindir)
