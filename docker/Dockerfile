FROM persesdev/perses:v0.55.0-beta.4 AS perses
FROM node:22.22.2-bookworm-slim
RUN npm install --global --prefix /opt/npm npm@12.2.0 --ignore-scripts --no-audit --no-fund
ENV PATH="/opt/npm/bin:${PATH}"
COPY --from=perses /bin/perses /bin/percli /usr/local/bin/
COPY --from=perses /etc/perses/plugins-archive /etc/perses/plugins-archive
WORKDIR /workspace/mapgl-perses
COPY --from=mapgl panel-core/ /workspace/mapgl/panel-core/
COPY perses-adapter/package.json ./perses-adapter/package.json
RUN ln -s ../mapgl/panel-core panel-core
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 8080 3001
CMD ["bash", "docker/start-dev.sh"]
