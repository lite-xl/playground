-- this is a thunk to launch core but stubs a bunch of functions

local connector = require "libraries.connector"

local core = require "core"

local err_msg = {}

function system.get_clipboard()
  local ok, text = connector.get_clipboard()
  print(ok, text)
  if not ok and err_msg[text] == nil then
    core.error("cannot interact with clipboard: %s", text)
    err_msg[text] = true
  end
  return ok and text or ""
end

function system.set_clipboard(text)
  local ok, err = connector.set_clipboard(text)
  if not ok and err_msg[err] == nil then
    core.error("cannot interact with clipboard: %s", err)
    err_msg[err] = true
  end
end

return core
