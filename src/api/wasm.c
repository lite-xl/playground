#include <stdio.h>
#include <unistd.h>

#include <lua.h>
#include <lauxlib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#error what are you even doing compiling this without emcc?
#endif

EM_ASYNC_JS(char *, file_upload, (char *dest, int dir), {
  try {
    const count = await Module.uploadFiles(UTF8ToString(dest), !!dir);
    return stringToNewUTF8("1" + count);
  } catch (e) {
    console.error(e);
    return stringToNewUTF8("0" + e.toString());
  }
})

EM_ASYNC_JS(char *, file_download, (char *path), {
  try {
    const count = await Module.downloadFiles(UTF8ToString(path));
    return stringToNewUTF8("1" + count);
  } catch (e) {
    console.error(e);
    return stringToNewUTF8("0" + e.toString());
  }
})

EM_ASYNC_JS(char *, clipboard_copy, (const char* str), {
  Module.clipboardText = UTF8ToString(str);
  try {
    await navigator.clipboard.writeText(Module.clipboardText);
    return null;
  } catch (e) {
    console.error(e);
    return stringToNewUTF8(e.toString());
  }
})

EM_ASYNC_JS(int, clipboard_paste, (char* *result, char* *err), {
  try {
    const str = await navigator.clipboard.readText();
    setValue(result, stringToNewUTF8(str), "*");
    return 0;
  } catch (e) {
    console.error(e);
    setValue(err, stringToNewUTF8(e.toString()), "*");
    setValue(result, stringToNewUTF8(Module.clipboardText || ""), "*");
    return -1;
  }
})

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

static int f_download_files(lua_State *L) {
  char *result = file_download((char *) luaL_checkstring(L, 1));
  if (*result == '0') {
    lua_pushnil(L);
  } else {
    lua_pushboolean(L, 1);
  }
  lua_pushstring(L, result + 1);
  free(result);
  return 2;
}

static int f_get_clipboard(lua_State *L) {
  char *err = NULL, *result = NULL;
  lua_settop(L, 0);
  if (clipboard_paste(&result, &err) == 0) {
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
  char *err = clipboard_copy(luaL_checkstring(L, 1));
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
    el.style.left = ($0 / window.devicePixelRatio) + "px";
    el.style.top = ($1 / window.devicePixelRatio) + "px";
    el.style.width = ($2 / window.devicePixelRatio) + "px";
    el.style.height = ($3 / window.devicePixelRatio) + "px";
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
  { NULL, NULL },
};

int luaopen_wasm(lua_State* L) {
  luaL_newlib(L, lib);
  return 1;
}
