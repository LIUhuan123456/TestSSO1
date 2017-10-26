#!/bin/bash
DIR=`dirname $0`
. "$DIR/config.sh"
SOURCE_DIR=$ROOT_DIR/releases/`date +%Y%m%d_%H%M%S`

echo "Install $SOURCE_DIR..."
if [ ! -d $SOURCE_DIR ]
then
        mkdir -p $SOURCE_DIR
fi

cp -r $DIR/../ $SOURCE_DIR

ln -sfT $SOURCE_DIR $CURRENT_DIR

echo "Installed"

pm2 show $PROJECT
if [ $? -eq 0 ]
then
    echo "$PROJECT is running, reloading..."
    pm2 delete $PROJECT
    pm2 start $SOURCE_DIR/server/server.js --name "$PROJECT"
    echo "$PROJECT reloaded"
else
    echo "$PROJECT is not running, starting..."
    pm2 start $SOURCE_DIR/server/server.js --name "$PROJECT"
    echo "$PROJECT started"
fi
