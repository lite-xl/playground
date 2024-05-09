--mod-version:3

local core = require "core"

local DocView = require "core.docview"
local connector = require "libraries.connector"

local last_x, last_y, last_w, last_h
local function set_text_input_rect(x, y, w, h)
  if x ~= last_x or y ~= last_y or w ~= last_w or h ~= last_h then
    last_x, last_y, last_w, last_h = x, y, w, h
    connector.set_text_input_rect(x, y, w, h)
  end
end

local function recalculate_input_rect(view)
  -- set caret position
  local line1, col1, line2, col2 = view.doc:get_selection(true)
  local x, y = view:get_line_screen_position(line1)
  local h = view:get_line_height()
  local col = math.min(col1, col2)

  local x1, x2 = 0, 0

  -- focus the whole text
  x1 = view:get_col_x_offset(line1, col1)
  x2 = view:get_col_x_offset(line2, col2)

  set_text_input_rect(x + x1, y, x2 - x1, h)
end

local docview_update = DocView.update
function DocView:update(...)
  docview_update(self, ...)
  if core.active_view == self then
    recalculate_input_rect(self)
  end
end

local core_set_active_view = core.set_active_view
function core.set_active_view(view)
  core_set_active_view(view)
  connector.focus_text_input(view:is(DocView))
end
