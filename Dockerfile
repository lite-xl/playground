FROM emscripten/emsdk:latest AS build

USER emscripten

ENV PATH="$PATH:/home/emscripten/.local/bin"

RUN pip install --no-cache --no-compile meson ninja

WORKDIR /build

COPY --chown=emscripten . .

RUN bash scripts/gh-pages-deploy.sh

FROM p3terx/darkhttpd:latest

COPY --from=build /build/github-pages /www

CMD ["/www", "--port", "80", "--chroot", "--no-listing"]

EXPOSE 80
