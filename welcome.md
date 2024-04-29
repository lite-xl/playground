# Welcome to Lite XL!

This is an instance of Lite XL, compiled with [Emscripten][1] and running
in your browser using [WebAssembly][2].

You can **create, edit and save files** with the editor and store them in
your browser. All data is stored in [IndexedDB][3] and restored when you
refresh the page or reopen the website in the **same browser** in the future.

# Autosave

This website automatically saves all the changes in the home folder
(`web_user`) every 5 seconds. You can configure the details in Settings.
If you close the page before the changes are saved, **your data will be lost.**
**Do not close the tab** if you see `Autosave: Saving...` on the top right corner.

# Privacy and Security

Your data will not be sent to any services or servers in the cloud
(except GitHub Pages, which is the service that this website is hosted on).
Everything stays in your browser, including the files you saved in here.


[1]: https://emscripten.org/
[2]: https://webassembly.org/
[3]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
