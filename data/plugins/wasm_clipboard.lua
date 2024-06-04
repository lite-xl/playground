--mod-version:3 --priority:0

-- This plugin allows interacting with the web browser clipboard.

local core = require "core"

local err_msg = {}

function system.get_clipboard()
  local text, err = wasm.get_clipboard()
  if err ~= nil and err_msg[err] == nil then
    core.error("cannot use clipboard: %s", err)
    err_msg[err] = true
  end
  return text
end

function system.set_clipboard(text)
  local err = wasm.set_clipboard(text)
  if err ~= nil and err_msg[err] == nil then
    core.error("cannot use clipboard: %s", err)
    err_msg[err] = true
  end
end
