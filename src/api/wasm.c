#include <stdio.h>
#include <string.h>
#include <unistd.h>

#include <lua.h>
#include <lauxlib.h>

#include <SDL.h>
#include <emscripten.h>

#define PROMISE_UPDATE_HANDLER "wasm_promise_update_handler"

EMSCRIPTEN_KEEPALIVE
int wasm_promise_update_handler(unsigned long promise_id) {
  SDL_Event ev = { 0 };
  ev.type = SDL_USEREVENT;
  ev.user.timestamp = SDL_GetTicks();
  SDL_PushEvent(&ev);
  return 1;
}

static int deserialize(lua_State *L, const char *str, size_t size) {
  int top = lua_gettop(L);
  if (luaL_loadbuffer(L, str, size, str) || lua_pcall(L, 0, LUA_MULTRET, 0)) {
    if (lua_gettop(L) - top == 0) lua_pushliteral(L, "luaL_loadbuffer() failed");
    return lua_error(L);
  }
  return lua_gettop(L) - top;
}

EM_ASYNC_JS(char *, clipboard_set, (const char* str), {
  Module.clipboardText = UTF8ToString(str);
  try {
    await navigator.clipboard.writeText(Module.clipboardText);
    return null;
  } catch (e) {
    console.error(e);
    return stringToNewUTF8(e.toString());
  }
})

EM_ASYNC_JS(int, clipboard_get, (char* *result, char* *err), {
  try {
    const str = await navigator.clipboard.readText();
    setValue(result, stringToNewUTF8(str), "*");
    return 0;
  } catch (e) {
    console.error(e);
    setValue(err, stringToNewUTF8(e.toString()), "*");
    setValue(result, stringToNewUTF8(Module.clipboardText ?? ""), "*");
    return -1;
  }
})

static int raise_em_error(lua_State *L, const char *msg) {
  lua_pushstring(L, msg);
  free((void *) msg);
  return lua_error(L);
}

static int f_get_promises(lua_State *L) {
  const char *type = luaL_optstring(L, 1, NULL);
  size_t size = 0;
  char *serialized = NULL;
  const char *err = EM_ASM_PTR({
    try {
      const promises = Module.promises.getPromisesSerialized($0 ? UTF8ToString($0) : undefined);
      const buf = stringToNewUTF8(promises);
      setValue($1, buf, '*');
      setValue($2, promises.length, 'i32');
      return 0;
    } catch (err) {
      console.trace(err);
      return stringToNewUTF8(err.toString());
    }
  }, type, &serialized, &size);
  if (err) return raise_em_error(L, err);

  int nval = deserialize(L, serialized, size);
  free(serialized);
  if (nval != 1)
    return luaL_error(L, "cannot deserialize promise, got %d values", nval);

  return 1;
}

static int f_upload_files(lua_State *L) {
  lua_settop(L, 5);
  const char *path = luaL_checkstring(L, 1);
  int is_dir = lua_toboolean(L, 2);

  int promise_id = 0;
  const char *err = (const char *) EM_ASM_PTR({
    try {
      const promise = uploadFiles(Module.promises, FS, UTF8ToString($0), $1);
      setValue($2, promise['id'], 'i32');
    } catch (err) {
      console.trace(err);
      return stringToNewUTF8(err.toString());
    }
  }, path, is_dir, &promise_id);
  if (err)
    return raise_em_error(L, err);
  lua_pushinteger(L, promise_id);
  return 1;
}

static int f_download_files(lua_State *L) {
  const char *path = luaL_checkstring(L, 1);

  int promise_id = 0;
  const char *err = EM_ASM_PTR({
    try {
      const promise = downloadFiles(Module.promises, FS, UTF8ToString($0));
      setValue($1, promise['id'], 'i32');
      return 0;
    } catch (err) {
      return stringToNewUTF8(err.toString());
    }
  }, path);
  if (err) return raise_em_error(L, err);
  lua_pushinteger(L, promise_id);
  return 1;
}

static int f_get_clipboard(lua_State *L) {
  char *err = NULL, *result = NULL;
  lua_settop(L, 0);
  if (clipboard_get(&result, &err) == 0) {
    lua_pushstring(L, result);
  } else {
    lua_pushstring(L, result);
    lua_pushstring(L, err);
  }
  free(result);
  free(err);
  return lua_gettop(L);
}

static int f_set_clipboard(lua_State *L) {
  lua_settop(L, 1);
  char *err = clipboard_set(luaL_checkstring(L, 1));
  if (err == NULL) {
    lua_pushstring(L, err);
    free(err);
  } else {
    lua_pushnil(L);
  }
  return 1;
}

static int f_focus_text_input(lua_State *L) {
  EM_ASM({ document.getElementById($0 ? "textinput" : "canvas").focus(); }, lua_toboolean(L, 1));
  return 0;
}

static int f_set_text_input_rect(lua_State *L) {
  lua_Number x = luaL_checknumber(L, 1);
  lua_Number y = luaL_checknumber(L, 2);
  lua_Number w = luaL_checknumber(L, 3);
  lua_Number h = luaL_checknumber(L, 4);
  EM_ASM({
    const el = document.getElementById("textinput");
    const scale = window.devicePixelRatio;
    el.style.left = `${$0 / scale}px`;
    el.style.top = `${$1 / scale}px`;
    el.style.width = `${$2 / scale}px`;
    el.style.height = `${$3 / scale}px`;
  }, x, y, w, h);
  return 0;
}

static luaL_Reg lib[] = {
  { "upload_files", f_upload_files },
  { "download_files", f_download_files },
  { "get_clipboard", f_get_clipboard },
  { "set_clipboard", f_set_clipboard },
  { "focus_text_input", f_focus_text_input },
  { "set_text_input_rect", f_set_text_input_rect },
  { "get_promises", f_get_promises },
  { NULL, NULL },
};

int luaopen_wasm(lua_State* L) {
  EM_ASM(Module.promises = new PromiseRegistry(Module.cwrap(UTF8ToString($0))), PROMISE_UPDATE_HANDLER);
  luaL_newlib(L, lib);
  return 1;
}
