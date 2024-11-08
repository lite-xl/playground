// #ifdef __EMSCRIPTEN__
// #include <emscripten/val.h>
// #else
// #error what are you even doing compiling this without emcc?
// #endif

#include <set>
#include <vector>
#include <fstream>
#include <iostream>
#include <filesystem>

#include <lua.hpp>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

#define PICOZIP_IMPLEMENTATION
#include "picozip.h"

#define WASM_CLIPBOARD_STRING "__wasm__clipboard_string"

using namespace emscripten;
namespace fs = std::filesystem;

template <typename T>
using deleted_unique_ptr = std::unique_ptr<T, std::function<void(T *)>>;

/**
 * Binds extra arguments to a callback function.
 */
template <typename... Args>
static val bind_callback(const char *fname, Args &&...args)
{
  return val::module_property(fname).call<val>("bind", val::undefined(), std::forward<Args>(args)...);
}

/**
 * Runs when a file is read with a FileReader.
 */
static void on_file_loaded(val dest, val resolve_fn, val reject_fn, val event)
{
  auto dest_path = dest.as<std::string>();
  auto dest_dir = fs::path(dest_path).parent_path();
  auto typed_array = val::global("Uint8Array").new_(event["target"]["result"]);
  auto buffer = convertJSArrayToNumberVector<unsigned char>(typed_array);

  try
  {
    fs::create_directories(dest_dir);
    std::ofstream output_file(dest_path, std::ios::out | std::ios::binary | std::ios::trunc);
    output_file.write(reinterpret_cast<char *>(buffer.data()), buffer.size());
    resolve_fn();
  }
  catch (fs::filesystem_error err)
  {
    reject_fn("mkdir(\"" + dest_dir.string() + "\"): " + err.what());
  }
}

/**
 * Runs when a file cannot be read with a FileReader.
 */
static void on_file_error(val dest, val reject_fn)
{
  reject_fn("cannot read " + dest.as<std::string>());
}

/**
 * A promise to write file to a destination path.
 */
static void promise_write_file(val f, val dest, val resolve_fn, val reject_fn)
{
  auto file_reader = val::global("FileReader").new_();
  file_reader.set("onload", bind_callback("on_file_loaded", dest, resolve_fn, reject_fn));
  file_reader.set("onerror", bind_callback("on_file_error", dest, reject_fn));
  file_reader.call<void>("readAsArrayBuffer", f);
}

/**
 * Runs when files are selected when uploading.
 */
static void on_file_selected(val dest, val resolve_fn, val reject_fn, val event)
{
  auto dest_dir = fs::path(dest.as<std::string>());
  auto files = val::global("Array").call<val>("from", event["target"]["files"]);
  auto write_promises = val::array();

  for (auto f : files)
  {
    auto name = f["webkitRelativePath"].isUndefined() || f["webkitRelativePath"].equals(val(""))
                    ? f["name"].as<std::string>()
                    : f["webkitRelativePath"].as<std::string>();
    auto dest_path = dest_dir / name;

    auto promise = val::global("Promise").new_(bind_callback("promise_write_file", f, dest_path.string()));
    write_promises.call<void>("push", promise);
  }

  // do not use rejection, embind.await() still can't handle it yet
  val::global("Promise").call<val>("all", write_promises).call<void>("then", resolve_fn, resolve_fn);
}

/**
 * Runs when the user cancels file upload.
 */
static void on_file_canceled(val resolve_fn)
{
  resolve_fn(val::array());
}

/**
 * A promise to allow user to upload files.
 */
static void promise_file_upload(val dest_dir, val is_dir, val resolve_fn, val reject_fn)
{
  auto file_input = val::global("document").call<val>("createElement", std::string("input"));
  file_input.set("type", "file");
  file_input.set("multiple", true);
  file_input.set("webkitdirectory", is_dir);
  file_input.set("onchange", bind_callback("on_file_selected", dest_dir, resolve_fn, reject_fn));
  file_input.set("oncancel", bind_callback("on_file_canceled", resolve_fn));
  file_input.call<void>("click");
}

static int f_upload_files(lua_State *L) noexcept
{
  auto path = luaL_checkstring(L, 1);
  auto is_dir = !!lua_toboolean(L, 2);

  auto results = val::global("Promise").new_(bind_callback("promise_file_upload", val(path), val(is_dir))).await();
  // Promise.all returns an array on success, and an error when failed
  lua_pushboolean(L, results.isArray());
  if (results.isArray())
  {
    lua_pushinteger(L, results["length"].as<int>());
  }
  else
  {
    lua_pushstring(L, results.call<val>("toString").as<std::string>().c_str());
  }
  return 2;
}

/**
 * Creates a download from the file.
 */
static bool download_file(std::string const &filename, const char *mem, size_t size)
{
  // create blob
  val blob_parts = val::array();
  blob_parts.set(0, val(typed_memory_view(size, mem)));
  val blob_options = val::object();
  blob_options.set("type", "application/octet-stream");
  val blob = val::global("Blob").new_(blob_parts, blob_options);

  // attach as file
  val object_url = val::global("URL").call<val>("createObjectURL", blob);
  val a = val::global("document").call<val>("createElement", val("a"));
  a.set("href", object_url);
  a.set("download", filename);
  val::global("document")["body"].call<void>("appendChild", a);
  a.call<void>("click");
  val::global("document")["body"].call<void>("removeChild", a);

  return true;
}

/**
 * Reads a file.
 */
static std::vector<unsigned char> read_file(std::string const &path)
{
  std::ifstream file(path, std::ios::in | std::ios::binary);
  return std::vector<unsigned char>(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
}

static int f_download_files(lua_State *L) noexcept
{
  fs::path path = luaL_checkstring(L, 1);
  if (fs::is_regular_file(path))
  {
    auto contents = read_file(path);
    lua_pushboolean(L, download_file(path.filename(), reinterpret_cast<const char *>(contents.data()), contents.size()));
    return 1;
  }

  if (fs::is_directory(path))
  {
    picozip_file *f = NULL;
    if (picozip_new_mem(&f) != PICOZIP_OK)
    {
      lua_pushboolean(L, 0);
      lua_pushliteral(L, "picozip_new_mem() failed");
      return 2;
    }

    deleted_unique_ptr<picozip_file> file(f, [](picozip_file *f)
                                          { picozip_free_mem(f); });

    std::set<fs::path> dirset = {path.filename() / ""};
    for (const auto &dirent : fs::recursive_directory_iterator(path))
    {
      auto is_file = dirent.is_regular_file();
      auto is_dir = dirent.is_directory();
      if (!is_file && !is_dir)
        continue;

      auto relative_path = fs::relative(dirent, path.parent_path());
      if (is_dir)
      {
        dirset.emplace(relative_path);
      }

      if (is_file)
      {
        if (picozip_new_entry_path(file.get(), relative_path.c_str(), dirent.path().c_str(), NULL, 0) != 0)
        {
          lua_pushboolean(L, 0);
          lua_pushliteral(L, "picozip_new_entry_path() failed");
          return 2;
        }
        // remove directories that actually has content, since we don't need to explicitly define those
        dirset.erase(relative_path.parent_path());
      }
    }

    // create empty directories
    for (const auto &path : dirset)
    {
      if (picozip_new_entry_mem(file.get(), path.c_str(), NULL, 0) != PICOZIP_OK)
      {
        lua_pushboolean(L, 0);
        lua_pushliteral(L, "picozip_new_entry_mem() failed");
        return 2;
      }
    }

    if (picozip_end(file.get()) != PICOZIP_OK)
    {
      lua_pushboolean(L, 0);
      lua_pushliteral(L, "picozip_end() failed");
      return 2;
    }

    void *buffer;
    size_t zip_size = picozip_get_mem(file.get(), &buffer);
    if (!zip_size)
    {
      lua_pushboolean(L, 0);
      lua_pushliteral(L, "picozip_get_mem() failed");
      return 2;
    }

    lua_pushboolean(L, download_file(path.filename().string() + ".zip", (const char *)buffer, zip_size));
    return 1;
  }

  lua_pushboolean(L, 0);
  lua_pushliteral(L, "unknown file type");
  return 2;
}

static int f_get_clipboard(lua_State *L) noexcept
{
  lua_settop(L, 0);
  try
  {
    std::string content = val::global("navigator")["clipboard"].call<val>("readText").await().as<std::string>();
    lua_pushlstring(L, content.c_str(), content.length());
  }
  catch (...)
  {
    lua_getfield(L, LUA_REGISTRYINDEX, WASM_CLIPBOARD_STRING);
    if (lua_isnil(L, -1))
    {
      lua_pop(L, 1);
      lua_pushliteral(L, "");
    }
  }
  return 1;
}

static int f_set_clipboard(lua_State *L) noexcept
{
  lua_settop(L, 1);
  std::string content = std::string(luaL_checkstring(L, 1));
  try
  {
    val::global("navigator")["clipboard"].call<val>("writeText", content).await();
  }
  catch (...)
  {
    lua_setfield(L, LUA_REGISTRYINDEX, WASM_CLIPBOARD_STRING);
  }
  return 0;
}

static int f_focus_text_input(lua_State *L) noexcept
{
  EM_ASM({document.getElementById($0 ? "textinput" : "canvas").focus()}, lua_toboolean(L, 1));
  return 0;
}

static int f_set_text_input_rect(lua_State *L) noexcept
{
  const auto x = luaL_checknumber(L, 1);
  const auto y = luaL_checknumber(L, 2);
  const auto w = luaL_checknumber(L, 3);
  const auto h = luaL_checknumber(L, 4);
  EM_ASM({
    const el = document.getElementById("textinput");
    el.style.left = ($0 / window.devicePixelRatio) + "px";
    el.style.top = ($1 / window.devicePixelRatio) + "px";
    el.style.width = ($2 / window.devicePixelRatio) + "px";
    el.style.height = ($3 / window.devicePixelRatio) + "px"; }, x, y, w, h);
  return 0;
}

static luaL_Reg lib[] = {
    {"upload_files", f_upload_files},
    {"download_files", f_download_files},
    {"get_clipboard", f_get_clipboard},
    {"set_clipboard", f_set_clipboard},
    {"focus_text_input", f_focus_text_input},
    {"set_text_input_rect", f_set_text_input_rect},
    {NULL, NULL},
};

extern "C"
{
  int luaopen_wasm(lua_State *L)
  {
    luaL_newlib(L, lib);
    return 1;
  }
}

EMSCRIPTEN_BINDINGS(wasm)
{
  // register callback functions
  function("promise_file_upload", promise_file_upload);
  function("promise_write_file", promise_write_file);
  function("on_file_selected", on_file_selected);
  function("on_file_canceled", on_file_canceled);
  function("on_file_loaded", on_file_loaded);
  function("on_file_error", on_file_error);
};