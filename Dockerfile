FROM emscripten/emsdk:latest AS build

USER emscripten

ENV PATH="$PATH:/home/emscripten/.local/bin"

RUN pip install meson ninja

WORKDIR /build

COPY --chown=emscripten . .

RUN bash scripts/gh-pages-deploy.sh

FROM nginx:latest

COPY --from=build /build/github-pages /usr/share/nginx/html
