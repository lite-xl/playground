FROM scratch AS src

ARG ESBUILD_VERSION=0.24.0
ARG ESBUILD_ARCH=x64
ARG LPM_VERSION=1.3.1
ARG LPM_ARCH=x86_64

ADD https://registry.npmjs.org/@esbuild/linux-x64/-/linux-${ESBUILD_ARCH}-${ESBUILD_VERSION}.tgz \
    /esbuild.tgz

ADD https://github.com/lite-xl/lite-xl-plugin-manager/releases/download/v${LPM_VERSION}/lpm.${LPM_ARCH}-linux \
    /lpm

FROM emscripten/emsdk:3.1.70 AS build

ARG PRODUCTION=true

RUN --mount=from=src,target=/src <<EOF
mkdir -p /esbuild
tar -oxzf /src/esbuild.tgz -C /esbuild
cp /src/lpm /bin/lpm
chmod +x /bin/lpm
EOF

ENV PATH="$PATH:/home/emscripten/.local/bin:/esbuild/package/bin"

USER emscripten

RUN pip install --no-cache --no-compile meson ninja

WORKDIR /build

COPY --chown=emscripten . .

RUN PRODUCTION=${PRODUCTION} bash scripts/gh-pages-deploy.sh

FROM p3terx/darkhttpd:latest

COPY --from=build /build/github-pages /www

CMD ["/www", "--port", "80", "--chroot", "--no-listing"]

EXPOSE 80
