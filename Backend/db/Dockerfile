FROM postgres:13-alpine
ENV LANG ja_JP.utf8

COPY ./db/scripts/initdb/* /docker-entrypoint-initdb.d/
