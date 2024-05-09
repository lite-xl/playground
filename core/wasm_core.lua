-- this is a thunk to launch core but stubs a bunch of functions

local connector = require "libraries.connector"

local core = require "core"

local err_msg = {}

function system.get_clipboard()
  local text, err = connector.get_clipboard()
  if err ~= nil and err_msg[err] == nil then
    core.error("cannot use clipboard: %s", err)
    err_msg[err] = true
  end
  return text
end

function system.set_clipboard(text)
  local err = connector.set_clipboard(text)
  if err ~= nil and err_msg[err] == nil then
    core.error("cannot use clipboard: %s", err)
    err_msg[err] = true
  end
end

return core
