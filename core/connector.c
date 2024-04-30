#include <stdio.h>
#include <unistd.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#error what are you even doing compiling this without emcc?
#endif

#define LITE_XL_PLUGIN_ENTRYPOINT
#include "lite_xl_plugin_api.h"

EM_ASYNC_JS(char *, idbsync_save_sync, (), {
  try {
    await Module.idbSync.save();
    return stringToNewUTF8("1");
  } catch (e) {
    console.error(e);
    return stringToNewUTF8("0" + e.toString());
  }
})

EM_ASYNC_JS(char *, file_upload, (char *dest, int dir), {
  try {
    const count = await Module.uploadFiles(UTF8ToString(dest), !!dir);
    return stringToNewUTF8("1" + count);
  } catch (e) {
    console.error(e);
    return stringToNewUTF8("0" + e.toString());
  }
})

static int f_idbsync_set_interval(lua_State *L) {
  EM_ASM({ Module.idbSync.setInterval($0); }, (int) luaL_checkinteger(L, 1));
  return 0;
}

static int f_idbsync_get_interval(lua_State *L) {
  lua_pushinteger(L, EM_ASM_INT({ return Module.idbSync.getInterval(); }));
  return 1;
}

static int f_idbsync_set_auto_sync(lua_State *L) {
  EM_ASM({ Module.idbSync.setAutoSync(!!$0); }, (int) lua_toboolean(L, 1));
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
  int nret = 1;
  char *result = idbsync_save_sync();
  if (*result == '0') {
    lua_pushnil(L);
    lua_pushstring(L, result + 1);
    nret = 2;
  } else {
    lua_pushboolean(L, 1);
  }
  free(result);
  return nret;
}

static int f_idbsync_save(lua_State *L) {
  EM_ASM({ Module.idbSync.save(); });
  return 0;
}

static int f_idbsync_save_debounced(lua_State *L) {
  EM_ASM({ Module.idbSync.saveDebounced($0); }, (int) luaL_checkinteger(L, 1));
  return 0;
}

static int f_idbsync_stop(lua_State *L) {
  EM_ASM({ Module.idbSync.stop(); });
  return 0;
}

static int f_idbsync_set_workspace_sync_status(lua_State *L) {
  EM_ASM({ Module.idbSync.setWorkspaceSyncStatus(UTF8ToString($0)); }, (char *) luaL_checkstring(L, 1));
  return 0;
}

static int f_upload_files(lua_State *L) {
  char *result = file_upload((char *) luaL_checkstring(L, 1), lua_toboolean(L, 2));
  // the function returns 0 as the first character if an error occured
  if (*result == '0') {
    lua_pushnil(L);
  } else {
    lua_pushboolean(L, 1);
  }
  lua_pushstring(L, result + 1);
  free(result);
  return 2;
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
  { "idbsync_set_workspace_sync_status", f_idbsync_set_workspace_sync_status },
  { "upload_files", f_upload_files },
  { NULL, NULL },
};

EMSCRIPTEN_KEEPALIVE int luaopen_lite_xl_connector(lua_State* L, void* XL) {
  lite_xl_plugin_init(XL);
  luaL_newlib(L, lib);
  return 1;
}
