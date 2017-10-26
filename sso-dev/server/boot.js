'use strict';
const fs = require('fs');
const aqumonPath = '/etc/aqumon.conf';
if (fs.existsSync(aqumonPath)) {
    const configs = fs.readFileSync(aqumonPath, {encoding: 'utf8'}).split(/\r?\n/ig);
    for (var i = 0; i < configs.length; i++) {
        if (configs[i]) {
            const index = configs[i].indexOf(' ');
            if (index >0) {
                process.env[configs[i].substring(0, index)] = configs[i].substring(index + 1);
            }
        }
    }
    console.log('env configs', process.env);
} else {
    throw new Error(`${aqumonPath} is required.`);
}
