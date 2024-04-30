--mod-version:3

-- This plugin literally adds the home folder to the project.

local core = require "core"
local connector = require "libraries.connector"

if system.get_file_info(USERDIR .. "/.first") == nil then
  core.add_project_directory("/usr/share/lite-xl")
  core.root_view:open_doc(core.open_doc("/usr/share/lite-xl/welcome.md"))

  local f, err = io.open(USERDIR .. "/.first", "w")
  if f == nil then
    core.error("cannot open file: %s", err)
    return
  end
  f:close()
  connector.idbsync_save_sync()
end
