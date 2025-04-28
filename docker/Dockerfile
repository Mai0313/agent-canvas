FROM nikolaik/python-nodejs:python3.10-nodejs20 AS builder

LABEL maintainer="Wei-Cheng Lee <ds_wei-cheng.lee@mediatek.com>" \
    org.label-schema.name="agent-canvas" \
    org.label-schema.vendor="Wei-Cheng Lee" \
    org.label-schema.schema-version="1.0" \
    com.centurylinklabs.watchtower.stop-signal="SIGINT"

RUN curl -s http://172.21.69.138/gpgkey/ca.crt > /usr/local/share/ca-certificates/mtk_ca.crt && \
    update-ca-certificates --fresh

########################################################################################

FROM builder AS prod
WORKDIR /app
COPY . .
RUN yarn install && \
    yarn cache clean --all && \
    yarn build
