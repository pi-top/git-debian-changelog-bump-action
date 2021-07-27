ARG DEBIAN_BASE_IMAGE=bullseye

FROM debian:$DEBIAN_BASE_IMAGE

# gbp provided by git-buildpackage
# Debian release names provided by libdistro-info-perl
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
  git-buildpackage \
  libdistro-info-perl \
 && rm -rf /var/lib/apt/lists/*
