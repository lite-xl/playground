--mod-version:3

-- This plugin exposes synctoggles for the user to change the interval.

local core = require "core"
local config = require "core.config"
local common = require "core.common"
local Doc = require "core.doc"

local connector = require "libraries.connector"


local setup_workspace_save
config.plugins.autosync = common.merge({
  -- If true, Lite XL will sync after some time.
  sync_auto = true,
  -- The interval in seconds to automatically sync changes.
  sync_interval = 5,
  -- If true, Lite XL will sync after a document is saved.
  sync_on_save = true,
  -- The time in seconds where Lite XL will debounce sync requests.
  save_debounce = 0.5,
  -- If true, the workspace will be synced if autosync is enabled.
  sync_workspace = true,
  -- config for settings ui
  config_spec = {
    name = "Sync",
    {
      label = "Automatic Sync",
      description = "If enabled, Lite XL will sync file changes at intervals.",
      path = "sync_auto",
      type = "toggle",
      default = true,
      on_apply = function(v)
        connector.idbsync_set_auto_sync(v)
        setup_workspace_save()
      end,
    },
    {
      label = "Sync Interval",
      description = "The interval in seconds which Lite XL saves file changes to the browser.",
      path = "sync_interval",
      type = "number",
      default = 5,
      min = 0.001,
      on_apply = function(v)
        connector.idbsync_set_interval(v * 1000)
        setup_workspace_save()
      end,
    },
    {
      label = "Sync On Save",
      description = "Saves file changes when a file is saved in Lite XL.",
      path = "sync_on_save",
      type = "toggle",
      default = true,
    },
    {
      label = "Save Debounce",
      description = "The time in seconds where multiple sync requests are treated as a single request.",
      path = "save_debounce",
      type = "number",
      default = 0.5,
      min = 0.001,
    },
    {
      label = "Sync Workspace",
      description = "Saves the workspace if Automatic Sync is enabled.",
      path = "sync_workspace",
      type = "toggle",
      default = true,
      on_apply = setup_workspace_save,
    },
  },
}, config.plugins.autosync)


-- override Doc:save to implement sync on save
local doc_save = Doc.save
function Doc:save(...)
  doc_save(self, ...)
  if config.plugins.autosync.sync_on_save then
    connector.idbsync_save_debounced(config.plugins.autosync.save_debounce * 1000)
  end
end

-- override core.load_user_directory to try to catch init.lua changes
local core_load_user_directory = core.load_user_directory
function core.load_user_directory()
  local ok, err = core_load_user_directory()
  if ok then
    connector.idbsync_set_interval(config.plugins.autosync.sync_interval * 1000)
    connector.idbsync_set_auto_sync(config.plugins.autosync.sync_auto)
    setup_workspace_save()
  end
  return ok, err
end

function setup_workspace_save()
  if config.plugins.autosync.sync_auto and config.plugins.autosync.sync_workspace then
    local last_save_time = system.get_time()
    local workspace_save = require "plugins.wasm_workspace"
    core.add_thread(function()
      while config.plugins.autosync.sync_auto and config.plugins.autosync.sync_workspace do
        if system.get_time() - last_save_time >= config.plugins.autosync.sync_interval then
          core.log_quiet("Syncing workspace...")
          core.try(workspace_save)
          last_save_time = system.get_time()
        end
        coroutine.yield(1/config.fps)
      end
    end)
  end
end
