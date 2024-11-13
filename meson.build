project('lite-xl',
    ['c'],
    version : '2.1.5',
    license : 'MIT',
    meson_version : '>= 0.63',
    default_options : ['c_std=gnu11']
)

#===============================================================================
# Project version including git commit if possible
#===============================================================================
version = meson.project_version()

if get_option('buildtype') != 'release'
    git_command = find_program('git', required : false)

    if git_command.found()
        git_commit = run_command(
            [git_command, 'rev-parse', 'HEAD'],
            check : false
        ).stdout().strip()

        if git_commit != ''
            version += ' (git-' + git_commit.substring(0, 8) + ')'
        endif
    endif
endif

#===============================================================================
# Configuration
#===============================================================================
conf_data = configuration_data()
conf_data.set('PROJECT_BUILD_DIR', meson.current_build_dir())
conf_data.set('PROJECT_SOURCE_DIR', meson.current_source_dir())
conf_data.set('PROJECT_VERSION', version)
conf_data.set('PROJECT_ASSEMBLY_VERSION', meson.project_version() + '.0')

#===============================================================================
# Compiler Settings
#===============================================================================
if host_machine.system() == 'darwin'
    add_languages('objc')
endif

cc = meson.get_compiler('c')

lite_includes = []
lite_cargs = ['-DSDL_MAIN_HANDLED', '-DPCRE2_STATIC', '-O3']
# On macos we need to use the SDL renderer to support retina displays
if get_option('renderer') or host_machine.system() == 'darwin'
    lite_cargs += '-DLITE_USE_SDL_RENDERER'
endif
if get_option('arch_tuple') != ''
    arch_tuple = get_option('arch_tuple')
else
    arch_tuple = '@0@-@1@'.format(target_machine.cpu_family(), target_machine.system())
endif
lite_cargs += '-DLITE_ARCH_TUPLE="@0@"'.format(arch_tuple)

#===============================================================================
# Linker Settings
#===============================================================================
lite_link_args = []
if host_machine.system() == 'darwin'
    lite_link_args += ['-framework', 'CoreServices', '-framework', 'Foundation']
elif host_machine.system() == 'emscripten'
    lite_link_args += [
        '-O3',
        '-s', 'ALLOW_MEMORY_GROWTH=1',
        '-s', 'ASYNCIFY=1',
        '-s', 'ENVIRONMENT=web,worker',
        '-s', 'EXIT_RUNTIME=1',
        '-s', 'EXPORTED_FUNCTIONS=_main',
        '-s', 'FILESYSTEM=1',
        '-s', 'FORCE_FILESYSTEM=1',
        '-s', 'IGNORE_MISSING_MAIN=0',
        '-s', 'INITIAL_HEAP=85983232',
        '-s', 'MODULARIZE=1',
        '-s', 'EXPORT_NAME=LiteXLModule',
        '-s', 'STACK_SIZE=1MB',
        '-s', 'SUPPORT_BIG_ENDIAN=1',
        '-s', 'WASM=1',
        '-s', 'MALLOC=emmalloc',
        '-s', 'EXPORTED_RUNTIME_METHODS=FS,ENV,IDBFS',
        '-lidbfs.js',
        '--minify', '0',
        '--pre-js', meson.current_source_dir() / 'src' / 'pre.js',
    ]
    if get_option('wasm_preload_files')
        lite_link_args += [
            '--preload-file',
            meson.current_source_dir() / 'data@/usr/share/lite-xl/'
        ]
    endif
    if get_option('wasm_debug') != 'none'
        # generates DWARF debug info
        lite_cargs += '-g'
        lite_link_args += '-g'
        if get_option('wasm_debug') == 'sourcemap'
            lite_link_args += ['-gsource-map']
            if get_option('wasm_sourcemap_base') != ''
                lite_link_args += ['--source-map-base', get_option('wasm_sourcemap_base')]
            endif
        endif
    endif
    if get_option('wasm_asyncify_advise')
        lite_link_args += ['-s', 'ASYNCIFY_ADVISE=1']
    endif
endif
#===============================================================================
# Dependencies
#===============================================================================
if not get_option('source-only')
    libm = cc.find_library('m', required : false)
    libdl = cc.find_library('dl', required : false)

    default_fallback_options = ['warning_level=0', 'werror=false']

    # Lua has no official .pc file
    # so distros come up with their own names
    lua_names = [
        'lua5.4', # Debian
        'lua-5.4', # FreeBSD
        'lua',    # Fedora
    ]

    if get_option('use_system_lua')
        foreach lua : lua_names
            last_lua = (lua == lua_names[-1] or get_option('wrap_mode') == 'forcefallback')
            lua_dep = dependency(lua, required : false,
            )
            if lua_dep.found()
                break
            endif

            if last_lua
                # If we could not find lua on the system and fallbacks are disabled
                # try the compiler as a last ditch effort, since Lua has no official
                # pkg-config support.
                lua_dep = cc.find_library('lua', required : true)
            endif
        endforeach
    else
        lua_dep = dependency('', fallback: ['lua', 'lua_dep'], required : true,
            default_options: default_fallback_options + ['default_library=static', 'line_editing=disabled', 'interpreter=false']
        )
    endif

    pcre2_options = ['default_library=static', 'grep=false', 'test=false']
    if host_machine.system() == 'emscripten'
        pcre2_options += ['jit=disabled', 'jit_sealloc=disabled']
    endif

    pcre2_dep = dependency('libpcre2-8', fallback: ['pcre2', 'libpcre2_8'],
        default_options: default_fallback_options + pcre2_options
    )

    freetype_dep = dependency('freetype2', fallback: ['freetype2', 'freetype_dep'],
        default_options: default_fallback_options + ['default_library=static', 'zlib=disabled', 'bzip2=disabled', 'png=disabled', 'harfbuzz=disabled', 'brotli=disabled']
    )


    sdl_options = ['default_library=static']

    # we explicitly need these
    if host_machine.system() == 'emscripten'
        sdl_options += 'use_loadso=disabled'
        sdl_options += 'prefer_dlopen=false'
        sdl_options += 'use_threads=disabled'
    else
        sdl_options += 'use_loadso=enabled'
        sdl_options += 'prefer_dlopen=true'
        sdl_options += 'use_threads=enabled'
    endif
    sdl_options += 'use_video=enabled'
    sdl_options += 'use_atomic=enabled'
    sdl_options += 'use_timers=enabled'
    # investigate if this is truly needed
    # Do not remove before https://github.com/libsdl-org/SDL/issues/5413 is released
    sdl_options += 'use_events=enabled'

    if host_machine.system() == 'darwin' or host_machine.system() == 'windows' or host_machine.system() == 'emscripten'
        sdl_options += 'use_video_x11=disabled'
        sdl_options += 'use_video_wayland=disabled'
    else
        sdl_options += 'use_render=enabled'
        sdl_options += 'use_video_x11=auto'
        sdl_options += 'use_video_wayland=auto'
    endif

    # we leave this up to what the host system has except on windows
    if host_machine.system() != 'windows'
        sdl_options += 'use_video_opengl=auto'
        sdl_options += 'use_video_openglesv2=auto'
    else
        sdl_options += 'use_video_opengl=disabled'
        sdl_options += 'use_video_openglesv2=disabled'
    endif

    # we don't need these
    sdl_options += 'test=false'
    sdl_options += 'use_sensor=disabled'
    sdl_options += 'use_haptic=disabled'
    sdl_options += 'use_hidapi=disabled'
    sdl_options += 'use_audio=disabled'
    sdl_options += 'use_cpuinfo=disabled'
    sdl_options += 'use_joystick=disabled'
    sdl_options += 'use_joystick_xinput=disabled'
    sdl_options += 'use_video_vulkan=disabled'
    sdl_options += 'use_video_offscreen=disabled'
    sdl_options += 'use_power=disabled'
    sdl_options += 'system_iconv=disabled'

    sdl_dep = dependency('sdl2', fallback: ['sdl2', 'sdl2_dep'],
        default_options: default_fallback_options + sdl_options
    )

    if host_machine.system() == 'windows'
        if sdl_dep.type_name() == 'internal'
            sdlmain_dep = dependency('sdl2main', fallback: ['sdl2main_dep'])
        else
            sdlmain_dep = cc.find_library('SDL2main')
        endif
    else
        sdlmain_dep = dependency('', required: false)
        assert(not sdlmain_dep.found(), 'checking if fake dependency has been found')
    endif

    lite_deps = [lua_dep, sdl_dep, sdlmain_dep, freetype_dep, pcre2_dep, libm, libdl]
endif
#===============================================================================
# Install Configuration
#===============================================================================
if get_option('portable') or host_machine.system() == 'windows' or host_machine.system() == 'emscripten'
    lite_bindir = '/'
    lite_docdir = '/doc'
    lite_datadir = '/data'
    configure_file(
        input: 'resources/windows/lite-xl.exe.manifest.in',
        output: 'lite-xl.exe.manifest',
        configuration: conf_data
    )
elif get_option('bundle') and host_machine.system() == 'darwin'
    lite_cargs += '-DMACOS_USE_BUNDLE'
    lite_bindir = 'Contents/MacOS'
    lite_docdir = 'Contents/Resources'
    lite_datadir = 'Contents/Resources'
    conf_data.set(
        'CURRENT_YEAR',
        run_command('date', '+%Y', capture: true).stdout().strip()
    )
    install_data('resources/icons/icon.icns', install_dir : 'Contents/Resources', install_tag: ['runtime'])
    configure_file(
        input : 'resources/macos/Info.plist.in',
        output : 'Info.plist',
        configuration : conf_data,
        install : true,
        install_dir : 'Contents',
        install_tag: ['runtime'],
    )
else
    lite_bindir = 'bin'
    lite_docdir = 'share/doc/lite-xl'
    lite_datadir = 'share/lite-xl'
    if host_machine.system() == 'linux'
        install_data('resources/icons/lite-xl.svg',
            install_dir : 'share/icons/hicolor/scalable/apps',
            install_tag: ['runtime'],
        )
        install_data('resources/linux/com.lite_xl.LiteXL.desktop',
            install_dir : 'share/applications',
            install_tag: ['runtime'],
        )
        install_data('resources/linux/com.lite_xl.LiteXL.appdata.xml',
            install_dir : 'share/metainfo',
            install_tag: ['runtime'],
        )
    endif
endif

excluded_plugins = []

if host_machine.system() != 'emscripten'
    excluded_plugins += [
        'wasm_add_project_folder.lua',
        'wasm_borderless.lua',
        'wasm_files.lua',
        'wasm_input.lua',
        'wasm_sync.lua',
        'wasm_treeview.lua',
        'wasm_workspace.lua'
    ]
endif

install_data('licenses/licenses.md', install_dir : lite_docdir, install_tag: 'docs')

if host_machine.system() != 'emscripten'
    install_subdir('docs/api' , install_dir : lite_datadir, strip_directory: true, install_tag: 'runtime')
endif
install_subdir('data/core' , install_dir : lite_datadir, exclude_files : 'start.lua', install_tag: 'runtime')
foreach data_module : ['fonts', 'plugins', 'colors']
    install_subdir(join_paths('data', data_module), install_dir : lite_datadir, exclude_files: excluded_plugins, install_tag: 'runtime')
endforeach

configure_file(
    input : 'data/core/start.lua',
    output : 'start.lua',
    configuration : conf_data,
    install_dir : join_paths(lite_datadir, 'core'),
    install_tag: 'runtime'
)

if get_option('wasm_debug') == 'sourcemap'
    install_subdir(
        'src',
        exclude_files: ['meson.build', 'bundle_open.m'],
        install_tag: 'sourcemap',
        install_dir: lite_bindir,
    )
    subproject_excludes = [
        'freetype2.wrap',
        'lua.wrap',
        'pcre2.wrap',
        'sdl2.wrap',
        'packagefiles',
        'packagecache',
    ]
    install_subdir(
        'subprojects',
        exclude_files: subproject_excludes,
        install_tag: 'sourcemap',
        install_dir: lite_bindir,
    )
endif

file_bundle = []
if not get_option('source-only')
    subdir('scripts')
    if host_machine.system() == 'emscripten' and get_option('wasm_build_bundle')
        plugins_target = []
        plugins_bundle_inc = []
        if get_option('wasm_install_plugins').length() > 0
            lpm_exe = find_program('lpm')
            lpm_cache_dir = 'lpm_cache'
            lpm_user_dir = 'lpm_user'
            lpm_args = [
                lpm_exe,
                '--cachedir', lpm_cache_dir,
                '--userdir', lpm_user_dir,
                '--datadir', meson.current_source_dir() / 'data',
                '--assume-yes',
                'install',
                get_option('wasm_install_plugins')
            ]
            
            plugins_target = custom_target(
                'plugins',
                command: lpm_args,
                input: ['meson.build'],
                output: [lpm_user_dir],
            )
            plugins_bundle_inc = ['--include-path', lpm_user_dir]
        endif

        bundle_js_name = 'lite-xl-files.js'
        bundle_dat_name = 'lite-xl-files.json'

        bundler_common_args = [
            '--start-lua', 'start.lua',
            '--prefix', '/usr/share/lite-xl',
            '--include-path', meson.current_source_dir(), meson.current_source_dir() / 'welcome.md',
            '--include-path', meson.current_source_dir() / 'data',
        ]

        foreach data_module : ['fonts', 'plugins', 'colors', 'core']
            bundler_common_args += meson.current_source_dir() / 'data' / data_module
        endforeach
        bundler_common_args += plugins_bundle_inc

        bundle_secondary_args = [
            wasm_bundler_exe,
            '--metafile', '@OUTPUT0@',
            bundler_common_args
        ]
        bundle_metafile = custom_target(
            bundle_js_name + '.meta',
            command: bundle_secondary_args,
            input: ['meson.build'],
            output: [bundle_js_name + '.meta'],
            depends: [plugins_target],
            build_always_stale: true
        )

        bundle_args = [
            wasm_bundler_exe,
            '--bundle',
            '--bundle-js', '@OUTPUT0@',
            '--bundle-dat', '@OUTPUT1@',
            '--metafile', '@OUTPUT0@.meta',
            bundler_common_args,
        ]

        bundle_target = custom_target(
            bundle_js_name,
            command: bundle_args,
            input: ['meson.build'],
            output: [bundle_js_name, bundle_dat_name],
            depends: [bundle_metafile, plugins_target],
            install: true,
            install_dir: [false, lite_bindir],
            install_tag: ['bundle']
        )
    endif
    subdir('src')
    if host_machine.system() == 'emscripten'
        subdir('shell')
    endif
endif
