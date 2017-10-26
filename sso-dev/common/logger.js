var log4js = require('log4js');
var fs = require('fs');
var path = require('path');

var conf_dir = process.env.logDir;
var logDir = `${conf_dir}/sso-log`;
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, 0777)
}
//log4js的配置
var _layout = {
    type: 'pattern',
    "pattern": "%[%d||requestid=%x{requestId}||uin=%x{uin}||server=%h||pid=%x{pid}||level=%p%]||%m",
    "tokens": {
        "pid": function() {
            return process.pid;
        },
        "requestId": function() {
            if (!imp.context || !imp.context.__requestid__) {
                return '00000000-0000-0000-0000-000000000000';
            } else {
                return imp.context.__requestid__;
            }
        },
        "uin": function() {
            if (!imp.context || !imp.context.__uin__) {
                return '00000';
            } else {
                return imp.context.__uin__;
            }
        }
    }
}

var log_conf = {
    appenders: [{
            type: 'console'
        }, //控制台输出
        {
            type: 'dateFile', //文件输出
            // layout: _layout,
            filename: `${logDir}/forward-log`,
            alwaysIncludePattern: true,
            pattern: '_yyyy-MM-dd',
            backups: 10,
            category: 'forward'
        },
        {
           type: 'dateFile',
           filename: `${logDir}/access-log`,
           pattern: '-yyyy-MM-dd',
           alwaysIncludePattern: true,
           backups: 10,
           category: 'access'
         },
        {
           type: 'dateFile',
           filename: `${logDir}/error-log`,
           pattern: '-yyyy-MM-dd',
           alwaysIncludePattern: true,
           backups: 10,
           category: 'error'
         }
    ]
};
log4js.configure(log_conf);
// 记录转发日志
var logf = log4js.getLogger('forward');
// 记录访问日志
var loga = log4js.getLogger('access');
// 记录错误日志
var loge = log4js.getLogger('error');

module.exports = {
    logf: logf,
    loga: loga,
    loge: loge
}
