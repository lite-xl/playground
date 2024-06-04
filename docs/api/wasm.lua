---@meta

---
---Wasm connector for browser specific operations
---@class wasm
wasm = {}

---
---Prompts the user to upload a file or directory.
---
---@param path string
---@param dir boolean? If true, the user will upload a directory.
---
---@return true|nil success
---@return string|nil error_msg
function wasm.upload_files(path, dir) end

---
---Downloads a file or directory.
---
---@param path string
---
---@return true|nil success
---@return string|nil error_msg
function wasm.download_files(path) end

---
---Gets the clipboard content.
---This function requires the Clipboard API, but will fall back to
---storing data as string if the API is not available.
---
---@return string content
---@return string|nil error_msg
function wasm.get_clipboard() end

---
---Sets the clipboard content.
---This function requires the Clipboard API, but will fall back to
---storing data as string if the API is not available.
---
---@param content string
---
---@return string|nil error_msg
function wasm.set_clipboard(content) end

---
---Sets focus to the text input element to support IME.
---
---@param focus boolean
function wasm.focus_text_input(focus) end

---
---Sets the dimension of the text input rectangle, to support IME.
---
---@param x number
---@param y number
---@param w number
---@param h number
function wasm.set_text_input_rect(x, y, w, h) end


return wasm
