#include <stdio.h>
#include <unistd.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#error what are you even doing compiling this without emcc?
#endif

#define LITE_XL_PLUGIN_ENTRYPOINT
#include "lite_xl_plugin_api.h"

static int f_eval_js(lua_State *L) {
  const char *script = luaL_checkstring(L, 1);
  lua_pushstring(L, emscripten_run_script_string(script));
  return 1;
}

static luaL_Reg lib[] = {
  { "eval_js", f_eval_js },
  { NULL, NULL },
};

EMSCRIPTEN_KEEPALIVE int luaopen_lite_xl_connector(lua_State* L, void* XL) {
  lite_xl_plugin_init(XL);
  luaL_newlib(L, lib);
  return 1;
}
