'use strict';
const app = require('./server');
const db = app.get('config_uc_db');
db['collation'] = 'utf8';
db['connectionLimit'] = 500;
console.log('db', db);

module.exports = {
  mydb: db
};

