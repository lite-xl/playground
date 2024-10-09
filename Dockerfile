FROM archlinux:base-devel AS build

RUN pacman -Syu --noconfirm meson git emscripten jre-openjdk-headless unzip npm

# Uncomment if you want emsdk
# RUN useradd -m --shell=/bin/false build && \
#     usermod -L build && \
#     echo "build ALL= NOPASSWD: /usr/bin/pacman" > /etc/sudoers.d/build
#
# USER build
#
# WORKDIR /home/build
#
# RUN git clone https://aur.archlinux.org/emsdk.git && \
#     cd emsdk && makepkg -sfi --noconfirm
#
# USER root

WORKDIR /build

COPY . .

RUN rm -rf build-emscripten-wasm32 github-pages && \
    source /etc/profile.d/emscripten.sh && \
    bash scripts/gh-pages-deploy.sh

FROM node:current-alpine

WORKDIR /dist

COPY --from=build /build/github-pages .

RUN npm i -g http-server

EXPOSE 8080

ENV NODE_ENV=production

ENTRYPOINT [ "npx", "http-server" ]
