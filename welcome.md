# Welcome to Lite XL!

This is an instance of Lite XL, compiled with [Emscripten][1] and running
in your browser using [WebAssembly][2].

You can **create, edit and save files** with the editor and store them in
your browser. All data is stored in [IndexedDB][3] and restored when you
refresh the page or reopen the website in the **same browser** in the future.

# Autosync

This website automatically saves all the changes in the home folder (`web_user`).
This includes your configuration and workspace layout.

# Upload & Download Files

You can also upload files from your device and edit it here. To do this,
press `ctrl+shift+p` and enter `wasm:upload-files`. You will be prompted with
the destination directory. After entering the destination directory,
you can choose the files that you want to upload.

To upload directories, you can use `wasm:upload-directory`
instead of `wasm:upload-files`. Note that empty directories will not be uploaded.

To get the files from here, you can use `wasm:download-file` and `wasm:download-directory`.
Lite XL will prompt you for the file or directory to download, and it will be downloaded
onto your device. Directories are downloaded as ZIP files while files are downloaded as-is.

You can also perform all these operations from the TreeView by right-clicking
a file or directory entry.

# Clipboard Operations

Lite XL uses the [Clipboard API][4] to access your system's clipboard.
If the API is not supported, then copy-pasting will only be available within the browser tab.
On Chrome and other Chromium-based browsers, a one-time confirmation will be shown
when pasting content into Lite XL.
On Firefox-based browsers, copy-pasting data within Lite XL will work,
but a confirmation prompt will be shown when pasting data outside of the tab
(e.g. from another application).

# Privacy and Security

Your data will not be sent to any services or servers in the cloud
(except GitHub Pages, which is the service that this website is hosted on).
Everything stays in your browser, including the files you saved in here.


[1]: https://emscripten.org/
[2]: https://webassembly.org/
[3]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard
