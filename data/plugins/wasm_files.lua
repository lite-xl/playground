--mod-version:3

-- This plugin allows users to upload their local files onto the website,
-- or download whatever that is on their browser.

local core = require "core"
local common = require "core.common"
local command = require "core.command"


local function suggest_directory(text)
  text = common.home_expand(text)
  local basedir = common.dirname(core.project_dir)
  return common.home_encode_list((basedir and text == basedir .. PATHSEP or text == "") and
    core.recent_projects or common.dir_path_suggest(text))
end

command.add(nil, {
  ["wasm:upload-files"] = function(dest)
    local function upload_files(dest)
      local real_dest = system.absolute_path(common.home_expand(dest)) --[[@as string]]
      local ok, err = wasm.upload_files(real_dest)
      if ok then
        core.log("%s file(s) uploaded to %s", err, common.home_encode(real_dest))
      else
        core.error("cannot upload file: %s", err)
      end
    end

    if dest ~= nil then
      upload_files(dest)
    else
      core.command_view:enter("Destination directory", {
        submit = upload_files,
        suggest = suggest_directory,
      })
    end
  end,

  ["wasm:upload-directory"] = function(dest)
    local function upload_directory(dest)
      local real_dest = system.absolute_path(common.home_expand(dest)) --[[@as string]]
      local ok, err = wasm.upload_files(real_dest, true)
      if ok then
        core.log("%s file(s) uploaded to %s", err, dest)
      else
        core.error("cannot upload directory: %s", err)
      end
    end

    if dest ~= nil then
      upload_directory(dest)
    else
      core.command_view:enter("Destination directory", {
        submit = upload_directory,
        suggest = suggest_directory,
      })
    end
  end,

  ["wasm:download-file"] = function(path)
    local function download_file(path)
      local real_path = system.absolute_path(common.home_expand(path)) --[[@as string]]
      local ok, err = wasm.download_files(real_path)
      if ok then
        core.log("downloaded %s", path)
      else
        core.error("cannot download %s: %s", path, err)
      end
    end

    if path ~= nil then
      download_file(path)
    else
      local files = {}
      for dir, item in core.get_project_files() do
        if item.type == "file" then
          local path = (dir == core.project_dir and "" or dir .. PATHSEP)
          table.insert(files, common.home_encode(path .. item.filename))
        end
      end
      core.command_view:enter("Source file", {
        submit = download_file,
        suggest = function(text)
          return common.fuzzy_match_with_recents(files, core.visited_files, text)
        end
      })
    end
  end,

  ["wasm:download-directory"] = function(path)
    local function download_directory(path)
      local real_path = system.absolute_path(common.home_expand(path)) --[[@as string]]
      local ok, err = wasm.download_files(real_path)
      if ok then
        core.log("%s file(s) from %s are downloaded", err, path)
      else
        core.error("cannot download directory: %s", err)
      end
    end

    if path ~= nil then
      download_directory(path)
    else
      core.command_view:enter("Destination directory", {
        submit = download_directory,
        suggest = suggest_directory,
      })
    end
  end,
})
