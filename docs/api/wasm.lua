---@meta

---
---Wasm connector for browser specific operations
---@class wasm
wasm = {}

---
---Sets the autosync interval.
---
---@param interval integer
function wasm.idbsync_set_interval(interval) end

---
---Gets the autosync interval.
---
---@return integer
function wasm.idbsync_get_interval() end

---
---Enables or disables autosync.
---
---@param enabled boolean
function wasm.idbsync_set_auto_sync(enabled) end

---
---Checks whether autosync is enabled.
---
---@return boolean
function wasm.idbsync_get_auto_sync() end

---
---Starts autosync.
---
function wasm.idbsync_start() end

---
---Syncs data to IndexedDB synchronously.
---
function wasm.idbsync_save_sync() end

---
---Syncs data to IndexedDB asynchronously.
---
function wasm.idbsync_save() end

---
---Starts a sync request with a given debounce period.
---
---@param debounce_period integer
function wasm.idbsync_save_debounced(debounce_period) end

---
---Stops autosync.
---
function wasm.idbsync_stop() end

---
---Sets the current workspace sync status.
---
---@param status string
function wasm.idbsync_set_workspace_sync_status(status) end

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