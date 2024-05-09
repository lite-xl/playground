--mod-version:3

-- This plugin adds context menu entries to treeview.

local core = require "core"
local config = require "core.config"
local command = require "core.command"

if config.plugins.treeview == false or require("plugins.treeview").contextmenu == nil then
    return
end

local ContextMenu = require "core.contextmenu"
local treeview = require "plugins.treeview"

-- if treeview size is larger than 40% of the screen, hide the thing by default
local w = system.get_window_size()
treeview:set_target_size("x", math.min(config.plugins.treeview.size, w / 100 * 40))

-- remove the open in system entry
for _, items in ipairs(treeview.contextmenu.itemset) do
    local context_items = items.items
    local remove = {}
    for i, item in ipairs(context_items) do
        remove[i] = item.command == "treeview:open-in-system"
    end
    -- remove them
    local i = 1
    while i <= #context_items do
        if remove[i] then
            table.remove(context_items, i)
        else
            i = i + 1
        end
    end
end

-- gets the current treeview item
local function treeitem()
    return treeview.hovered_item or treeview.selected_item
end

-- register context menu entries
treeview.contextmenu:register(
    function()
        local item = treeitem()
        return core.active_view == treeview and item and item.type == "dir"
    end,
    {
        ContextMenu.DIVIDER,
        { text = "Upload Files", command = "wasm-treeview:upload-files" },
        { text = "Upload Folder", command = "wasm-treeview:upload-directory" },
        ContextMenu.DIVIDER,
        { text = "Download Folder", command = "wasm-treeview:download-directory" },
    }
)
treeview.contextmenu:register(
    function()
        local item = treeitem()
        return core.active_view == treeview and item and item.type == "file"
    end,
    {
        ContextMenu.DIVIDER,
        { text = "Download File", command = "wasm-treeview:download-file" }
    }
)

-- register commands to download files
command.add(
    function()
        local item = treeitem()
        return item ~= nil and (core.active_view == treeview or treeview.contextmenu.show_context_menu) and item.type == "dir", item
    end,
    {
        ["wasm-treeview:download-directory"] = function(item)
            command.perform("wasm:download-directory", item.abs_filename)
        end,
        ["wasm-treeview:upload-directory"] = function(item)
            command.perform("wasm:upload-directory", item.abs_filename)
        end,
        ["wasm-treeview:upload-files"] = function(item)
            command.perform("wasm:upload-files", item.abs_filename)
        end
    }
)

command.add(
    function()
        local item = treeitem()
        return item ~= nil and (core.active_view == treeview or treeview.contextmenu.show_context_menu) and item.type == "file", item
    end,
    {
        ["wasm-treeview:download-file"] = function(item)
            command.perform("wasm:download-file", item.abs_filename)
        end
    }
)
