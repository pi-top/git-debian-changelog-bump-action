ARG DEBIAN_BASE_IMAGE=bookworm

FROM debian:$DEBIAN_BASE_IMAGE

# gbp provided by git-buildpackage
# Debian release names provided by libdistro-info-perl
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
  git-buildpackage \
  libdistro-info-perl \
	lsb-release \
 && rm -rf /var/lib/apt/lists/*

# The runner's checkout is owned by a different user than the container's root
RUN git config --system --add safe.directory '*'
