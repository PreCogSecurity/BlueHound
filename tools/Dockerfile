FROM centos:centos8.3.2011 AS builder

## Set up dependencies
RUN yum install -y epel-release; yum check-update; pwd
RUN yum install -y rsync git
RUN dnf module list nodejs && dnf module enable -y nodejs:16
RUN dnf install -y nodejs

# Clone repo and install npm required packages
RUN git clone -b develop https://github.com/zeronetworks/BlueHound.git /usr/local/src/bluehound

# Install and build application
WORKDIR /usr/local/src/bluehound
# `npm ci` installs exactly what the committed lockfile pins and fails loudly if
# package.json and the lockfile disagree. A lockfile must be committed for this
# to work; without one, fall back to `npm install` (unpinned) deliberately.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
RUN npm run build

## Launch webserver
FROM nginx:mainline AS bluehound
LABEL org.opencontainers.image.authors="support@zeronetworks.com"
WORKDIR /usr/share/nginx/html
COPY --from=builder /usr/local/src/bluehound/dist /usr/share/nginx/html
# The nginx image ships an unprivileged `nginx` user; serving the dashboard as
# root gives a web-facing content bug a container-escape foothold.
USER nginx
