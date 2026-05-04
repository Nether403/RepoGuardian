# syntax=docker/dockerfile:1
FROM meteor/galaxy-node:22.9.0

# Install pnpm via corepack (ships with Node 22)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all package.json files so pnpm can resolve the workspace graph
COPY artifacts/api/package.json ./artifacts/api/
COPY artifacts/web/package.json ./artifacts/web/
COPY lib/advisory/package.json ./lib/advisory/
COPY lib/analysis-view-model/package.json ./lib/analysis-view-model/
COPY lib/api-client/package.json ./lib/api-client/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/dependencies/package.json ./lib/dependencies/
COPY lib/ecosystems/package.json ./lib/ecosystems/
COPY lib/execution/package.json ./lib/execution/
COPY lib/github/package.json ./lib/github/
COPY lib/issues/package.json ./lib/issues/
COPY lib/patches/package.json ./lib/patches/
COPY lib/persistence/package.json ./lib/persistence/
COPY lib/prs/package.json ./lib/prs/
COPY lib/review/package.json ./lib/review/
COPY lib/runs/package.json ./lib/runs/
COPY lib/shared-types/package.json ./lib/shared-types/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the full monorepo (libs + api + web)
RUN pnpm -r --if-present run build

# Expose the API port (default 3000, override via PORT env var)
EXPOSE 3000

CMD ["node", "artifacts/api/dist/index.js"]
