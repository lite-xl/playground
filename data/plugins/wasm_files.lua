--mod-version:3

-- This plugin allows users to upload their local files onto the website,
-- or download whatever that is on their browser.

local core = require "core"
local common = require "core.common"
local command = require "core.command"
local config  = require "core.config"
local RootView = require "core.rootview"
local style    = require "core.style"


---number of seconds before a completed upload is dismissed
local DISMISS_TIME = 2
---the animation duration when an item is dismissed
local DISMISS_ANIMATION_TIME = 0.15
---width of the status popup, in number of characters with style.font
local POPUP_WIDTH = 64


local function suggest_directory(text)
  text = common.home_expand(text)
  local basedir = common.dirname(core.project_dir)
  return common.home_encode_list((basedir and text == basedir .. PATHSEP or text == "") and
    core.recent_projects or common.dir_path_suggest(text))
end


local promise_map, promise_list

---Creates a thread to monitor all promise completion.
local function monitor_promises()
  if promise_map then return end
  core.add_thread(function()
    promise_map, promise_list = {}, {}
    repeat
      -- merge and update promise dismiss time
      local current_promises = wasm.get_promises()
      local current_time = system.get_time()
      for _, promise in ipairs(current_promises) do
        local prev_promise = promise_map[promise.id]
        promise.dismiss_at = prev_promise and prev_promise.dismiss_at or (promise.done and current_time + DISMISS_TIME or nil)
        promise_map[promise.id] = promise
      end
      -- copy promises that hadn't expired to the list
      promise_list = {}
      local ids_to_remove = {}
      for _, promise in pairs(promise_map) do
        if not promise.done or promise.dismiss_at > current_time then
          promise_list[#promise_list+1] = promise
        else
          ids_to_remove[#ids_to_remove+1] = promise.id
        end
      end
      -- remove promise from the map
      for _, id in ipairs(ids_to_remove) do
        promise_map[id] = nil
      end
      -- sort list by the ID (which is always in insertion order)
      table.sort(promise_list, function(a, b) return a.id < b.id end)

      if #promise_list > 0 then core.redraw = true end
      coroutine.yield(1 / config.fps)
    until #promise_list == 0
    promise_map, promise_list = nil, nil
  end)
end


local rootview_draw = RootView.draw
function RootView:draw(...)
  rootview_draw(self, ...)
  if not promise_list or #promise_list == 0 then return end

  local _, y = self:get_content_offset()
  local w = style.font:get_width(string.rep("A", 48)) + style.padding.x * 2
  local h = style.font:get_height() * 2 + style.padding.y * 2
  local actual_w = w - style.padding.x * 2
  local x = self.size.x - style.padding.x - w
  y = y + style.padding.y

  for _, operation in ipairs(promise_list) do
    local color, status, progress
    if operation.type == "upload" then
      if operation.error then
        color, progress, status = style.error, 1, string.format("Error: %s", operation.error)
      elseif operation.status == "canceled" then
        color, progress, status = style.warn, 1, "Upload canceled."
      elseif operation.done and operation.total > 0 then
        color, progress, status = style.good, 1, string.format("%d file%s uploaded.", operation.total, operation.total > 1 and "s" or "")
      else
        color = style.accent
        if operation.status == "pending" then
          progress, status = 1, "Waiting for user input..."
        else
          progress = operation.read / operation.total
          status = string.format("(%s/%s): Uploading ", operation.read, operation.total)
          local filename = operation.last or "files"
          local filename_len = #filename > (POPUP_WIDTH - #status) and (POPUP_WIDTH - #status - 3) or filename
          status = status .. (#filename > (POPUP_WIDTH - #status) and ("..." .. filename:sub(-filename_len, -1)) or filename)
        end
      end
    else
      color, status, progress = style.error, "Unknown type", 1
    end

    local time_remaining = (operation.dismiss_at ~= nil and operation.dismiss_at or math.huge) - system.get_time()
    local dismiss_progress = common.clamp(time_remaining > DISMISS_ANIMATION_TIME and 1 or time_remaining / DISMISS_ANIMATION_TIME, 0, 1)
    local popup_h = common.lerp(0, h, dismiss_progress)
    local percentage_h = style.font:get_height() * 0.5

    core.push_clip_rect(x - 1, y - 1, w + 2, popup_h + 2)
    renderer.draw_rect(x - 1, y - 1, w + 2, popup_h + 2, style.text)
    renderer.draw_rect(x, y, w, popup_h, style.background)

    local last_y = y
    y = y + style.padding.y + (style.font:get_height() - percentage_h) / 2
    renderer.draw_rect(x + style.padding.x, y, progress * actual_w, percentage_h, color)
    y = y + percentage_h + (style.font:get_height() - percentage_h) / 2
    _, y = common.draw_text(style.font, style.text, status, "left", x + style.padding.x, y, actual_w, style.font:get_height())
    y = y + style.padding.y
    -- use height after clipping
    y = last_y + popup_h + 1
    core.pop_clip_rect()
    -- add some padding before drawing the other popup
    y = y + style.padding.y
  end
end

command.add(nil, {
  ["wasm:upload-files"] = function(dest)
    local function upload_files(dest)
      local real_dest = system.absolute_path(common.home_expand(dest)) --[[@as string]]
      wasm.upload_files(real_dest)
      monitor_promises()
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
      wasm.upload_files(real_dest, true)
      monitor_promises()
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
