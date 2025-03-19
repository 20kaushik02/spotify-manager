ARG APP_USER_DEFAULT=node
ARG NODE_ENV_DEFAULT=production

FROM node:lts-alpine AS base

ARG NODE_ENV_DEFAULT
ENV NODE_ENV=${NODE_ENV_DEFAULT}

ARG APP_USER_DEFAULT
ENV APP_USER=${APP_USER_DEFAULT}

WORKDIR /usr/src/app

FROM base AS build

COPY --chown=${APP_USER}:${APP_USER} package.json package-lock.json ./
RUN npm ci --include=prod --include=dev

COPY --chown=${APP_USER}:${APP_USER} . .
RUN npm run build

FROM base AS final

COPY --chown=${APP_USER}:${APP_USER} package.json package-lock.json ./
RUN npm ci --include=prod

COPY --from=build --chown=${APP_USER}:${APP_USER} /usr/src/app/dist dist
RUN mkdir dist/logs && chown -R ${APP_USER} dist/logs

USER ${APP_USER}

CMD [ "npm", "start" ]
