#!/usr/bin/env bash

set -e

DEPLOYED_TAG=$(cat $GITHUB_WORKSPACE/DEPLOYED)
DEPLOYED_VERSION=$(echo $DEPLOYED_TAG | cut -d '-' -f 1)
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-skale-manager/

# TODO: remove when upgrade skale-manager with using new node js
# or install old version of node
if [[ $DEPLOYED_VERSION == "1.8.1" ]] && [[ $NODE_VERSION != 12.* ]]
then
    echo "Skip upgrade check because of incompatible node.js version"
    exit 0
fi

git clone --branch $DEPLOYED_TAG https://github.com/$GITHUB_REPOSITORY.git $DEPLOYED_DIR

npx ganache-cli --gasLimit 8000000 --quiet &
GANACHE_PID=$!

cd $DEPLOYED_DIR
yarn install
PRODUCTION=true VERSION=$DEPLOYED_VERSION npx hardhat run migrations/deploy.ts --network localhost
rm $GITHUB_WORKSPACE/.openzeppelin/unknown-*.json || true
cp .openzeppelin/unknown-*.json $GITHUB_WORKSPACE/.openzeppelin
ABI_FILENAME="skale-manager-$DEPLOYED_VERSION-localhost-abi.json"
cp "data/$ABI_FILENAME" "$GITHUB_WORKSPACE/data"
cd $GITHUB_WORKSPACE
rm -r --interactive=never $DEPLOYED_DIR

ABI="data/$ABI_FILENAME" npx hardhat run migrations/upgrade.ts --network localhost

kill $GANACHE_PID
