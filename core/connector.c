#include <stdio.h>
#include <unistd.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#error what are you even doing compiling this without emcc?
#endif

#define LITE_XL_PLUGIN_ENTRYPOINT
#include "lite_xl_plugin_api.h"

EM_ASYNC_JS(void, idbsync_save_sync, (), {
  await Module.idbSync.save();
})

static int f_idbsync_set_interval(lua_State *L) {
  int interval = luaL_checkinteger(L, 1);
  EM_ASM({ Module.idbSync.setInterval($0); }, interval);
  return 0;
}

static int f_idbsync_get_interval(lua_State *L) {
  lua_pushinteger(L, EM_ASM_INT({ return Module.idbSync.getInterval(); }));
  return 1;
}

static int f_idbsync_set_auto_sync(lua_State *L) {
  int enabled = lua_toboolean(L, 1);
  EM_ASM({ Module.idbSync.setAutoSync(!!$0); }, enabled);
  return 0;
}

static int f_idbsync_get_auto_sync(lua_State *L) {
  lua_pushboolean(L, EM_ASM_INT({ return Module.idbSync.getAutoSync(); }));
  return 1;
}

static int f_idbsync_start(lua_State *L) {
  EM_ASM({ Module.idbSync.start(); });
  return 0;
}

static int f_idbsync_save_sync(lua_State *L) {
  idbsync_save_sync();
  return 0;
}

static int f_idbsync_save(lua_State *L) {
  EM_ASM({ Module.idbSync.save(); });
  return 0;
}

static int f_idbsync_save_debounced(lua_State *L) {
  int debounceTime = luaL_checkinteger(L, 1);
  EM_ASM({ Module.idbSync.saveDebounced($0) }, debounceTime);
  return 0;
}

static int f_idbsync_stop(lua_State *L) {
  EM_ASM({ Module.idbSync.stop(); });
  return 0;
}

static luaL_Reg lib[] = {
  { "idbsync_set_interval", f_idbsync_set_interval },
  { "idbsync_get_interval", f_idbsync_get_interval },
  { "idbsync_set_auto_sync", f_idbsync_set_auto_sync },
  { "idbsync_get_auto_sync", f_idbsync_get_auto_sync },
  { "idbsync_start", f_idbsync_start },
  { "idbsync_save_sync", f_idbsync_save_sync },
  { "idbsync_save", f_idbsync_save },
  { "idbsync_save_debounced", f_idbsync_save_debounced },
  { "idbsync_stop", f_idbsync_stop },
  { NULL, NULL },
};

EMSCRIPTEN_KEEPALIVE int luaopen_lite_xl_connector(lua_State* L, void* XL) {
  lite_xl_plugin_init(XL);
  luaL_newlib(L, lib);
  return 1;
}
