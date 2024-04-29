--mod-version:3

-- This plugin literally adds the home folder to the project.

local core = require "core"
local connector = require "libraries.connector"

if system.get_file_info(USERDIR .. "/.first") == nil then
    local found = false
    local home = os.getenv("HOME")
    for _, v in ipairs(core.project_directories) do
        if v.name == home then
            found = true
            break
        end
    end
    -- work around old versions that allows duplicate entries
    if not found then
        core.add_project_directory(os.getenv('HOME'))
    end
    local f, err = io.open(USERDIR .. "/.first", "w")
    if f == nil then
        core.error("cannot open file: %s", err)
        return
    end
    f:close()
    connector.idbsync_save_sync()
end
