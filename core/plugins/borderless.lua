--mod-version:3

local config = require "core.config"
local TitleView = require "core.titleview"

config.borderless = true

function TitleView:draw_window_controls()
end

function TitleView:on_mouse_left()
    TitleView.super.on_mouse_left(self)
end

function TitleView:on_mouse_pressed(...)
    TitleView.super.on_mouse_pressed(self, ...)
end


function TitleView:on_mouse_moved(px, py, ...)
    TitleView.super.on_mouse_moved(self, px, py, ...)
end
