#!/bin/bash
###############################################################
#                Unofficial 'Bash strict mode'                #
# http://redsymbol.net/articles/unofficial-bash-strict-mode/  #
###############################################################
set -euo pipefail
IFS=$'\n\t'
###############################################################

# gbp provided by git-buildpackage
# Debian release names provided by libdistro-info-perl
dev_packages=("git-buildpackage" "libdistro-info-perl")

# Tell apt-get we're never going to be able to give manual feedback
export DEBIAN_FRONTEND=noninteractive

# Update the package listing, so we know what package exist
apt-get update

# Install security updates
apt-get -y upgrade

# Install new packages, without unnecessary recommended packages
apt-get -y install --no-install-recommends "${dev_packages[@]}"

# Delete cached files we don't need anymore
apt-get clean
rm -rf /var/lib/apt/lists/*
