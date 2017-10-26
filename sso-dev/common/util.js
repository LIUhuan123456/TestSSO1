'use strict';

const imp = module.exports = {};

const ZooKeeper = require("zookeeper");
const crypto = require('crypto');
const request = require('request');
const common = require('./common');
const Errs = require('./errors');
const superagent = require('superagent');
const async = require('async');
var Redis = require('ioredis');
var redis = new Redis({
    sentinels: [{
        host: 'test.aqumon.com',
        port: 26379
    }],
    // host: 'test.aqumon.com', port: 26379,
    password: '#redis#@aqumon',
    name: 'redis-master'
});

const zk = new ZooKeeper({
    connect: process.env.zkServer,
    timeout: 200000,
    debug_level: ZooKeeper.ZOO_LOG_LEVEL_WARN,
    host_order_deterministic: false
});

imp.getZKConfig = (_path, cb) => {
    zk.connect(function(err) {
        if (err) {
            console.log('zkerr', err);
            throw err;
        }
        console.log("zk session established, id=%s", zk.client_id);
        zk.a_get(_path, true, (rc, error, stat, data) => {
            console.log(rc);
            console.log(error);
            console.log(_path);
            let _data = data;
            if (data) {
                _data = Buffer.from(data).toString();
            }
            console.log(_data);

            cb(error, _data)
        });
    });
}

imp.md5 = (data) => {
    var md5 = crypto.createHash('md5');
    md5.update(data);
    var d = md5.digest('hex');
    return d;
};

imp.generateSalt = () => {
    return crypto.randomBytes(32);
};

imp.hashPassword = (pwd, salt) => {
    const _pwd = crypto.pbkdf2Sync(Buffer.from(imp.md5(pwd), 'hex'), salt, 10000, 32, 'sha256');
    return _pwd;
};

imp.proxy = (options, cb) => {
    // let others = _.omit(options, ['body']);
    // logger.debug('proxy-options', others);
    const t0 = Date.now();
    //console.log('options', options);
    // const _context = logger.getContext();
    request(options, function(error, response, data) {
        if (response && options) {
            console.log("proxy response code:", options.url, response.statusCode);
            if (response.statusCode !== 200) {
                console.log("proxy response data:", data);
            }
        }

        // logger.setContext(_context);
        // logger.stat(`${options.method || ''}-${options.url}-cost`, `${(Date.now() - t0)}ms`);
        if (error) {
            // logger.error('response-error', error);
        }
        let _statusCode = -1;
        if (response && response.statusCode) { //merge information below three
            _statusCode = response.statusCode
                // logger.debug(options.url + '-statusCode', response.statusCode);
        }
        let _dataLength = -1;
        if (data) {
            _dataLength = data.length;
            // logger.debug(options.url + '-data-length', data.length);
        }
        let _headers = {};
        if (response && response.headers['content-type']) {
            _headers = response.headers;
            // logger.debug(options.url + '-content-type', response.headers['content-type']);
        }
        // logger.debug(['url', options.url, 'statusCode', _statusCode, 'data-length', _dataLength, 'headers', _headers]);
        if (error || (response && response.statusCode && !(response.statusCode >= 200 && response.statusCode < 300))) {
            // cb(utilImp.errHandle(err_code.io_http_response_err, `http err, statusCode= ${response?response.statusCode: -1}`, error));
            cb(error);
            return;
        } else {
            let willData = data;
            let willErr = null;
            if (response.headers['content-type'] && (response.headers['content-type']).trim().toLocaleLowerCase().includes('application/json')) {
                try {
                    willData = JSON.parse(data);
                    // if (willData.code != 0) {
                    //     willErr = _.omit(options, ['data']);
                    // }
                } catch (jsonErr) {
                    willErr = jsonErr; //utilImp.errHandle(err_code.io_http_response_err, 'proxy-parse', jsonErr);
                }
            }
            // console.log('willData', willData);
            console.log('willErr', willErr);
            cb(willErr, willData, response);
        }
    })
};

const configBase = process.env.name;
imp.generateUid = (type, cb) => {
    zk.connect(function(err) {
        if (err) throw err;
        console.log("zk session established, id=%s", zk.client_id);
        var zk_node_path = `/${configBase}/user-center/type${type}/id1`;
        zk.a_create(`${zk_node_path}`, "some value", ZooKeeper.ZOO_SEQUENCE, function(rc, error, path) {
            if (rc != 0) {
                console.log("zk node create result: %d, error: '%s', path=%s", rc, error, path);
                cb(err);
            } else {
                const defaultNumber = type * 1000000;
                console.log("created zk node %s", path);
                //console.log("pathsubstring", path.substring(zk_node_path.length));
                //console.log("zklen", zk_node_path.length);
                //console.log("parseInt", parseInt(path.substring(zk_node_path.length)));
                const uid = defaultNumber + parseInt(path.substring(zk_node_path.length));
                console.log("created uids", uid);
                cb(err, uid);
            }
        });
    });
}

const httpRegex = "^((https|http|ftp|rtsp|mms)?://)" + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" + "(([0-9]{1,3}\.){3}[0-9]{1,3}" + "|" + "([0-9a-z_!~*'()-]+\.)*" + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\." + "[a-z]{2,6})" + "(:([0-9]{1,4}))?" + "((/?)|" + "(/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+/?)$";
imp.parseHttp = (_str) => {
    if (_str) {
        const result = _str.match(httpRegex);
        let _port = result[9];
        if (!_port) {
            _port = '';
        }
        return {
            protocol: result[2],
            host: result[5],
            port: result[9].replace(':', '')
        };
    } else {
        return;
    }
}

imp.isEmail = (_email) => {
    return /\w[-\w.+]*@([A-Za-z0-9][-A-Za-z0-9]+\.)+[A-Za-z]{2,14}/.test(_email);
}

imp.initAccount = (user, cookie, cb) => {
    async.waterfall([
            function(callback) {
                const _data = {
                    "flag": 32,
                    "product_id": 6,
                    "base_currency": 32
                };
                const option = {
                    url: common.serviceUrls.URL_ACCOUNT_BUNDLE.replace(':uid', user.uid),
                    headers: {
                        "content-type": 'application/json',
                        "cookie": cookie
                    },
                    method: 'post',
                    body: JSON.stringify(_data)
                };
                imp.proxy(option, (proxyErr, proxyData) => {
                    user['accountBundle'] = proxyData;
                    callback(proxyErr, proxyData);
                })
            },
            function(_accountBundle, callback) {
                const _data = {
                    "broker_account_id": _accountBundle.broker_account.id,
                    "currency": "HKD",
                    "amount": 100000
                };
                const option = {
                    url: common.serviceUrls.URL_CASH_ACCOUNT.replace(':uid', user.uid),
                    headers: {
                        "content-type": 'application/json',
                        "cookie": cookie
                    },
                    method: 'post',
                    body: JSON.stringify(_data)
                };
                imp.proxy(option, (proxyErr, proxyData) => {
                    user['cashAccount'] = proxyData;
                    callback(proxyErr, proxyData);
                })
            },
            function(_cashAccount, callback) {
                const _data = {
                    "name": "国都账户",
                    "product_id": 6,
                    "flag": 32,
                    "broker_account_id": _cashAccount.broker_account_id
                };
                const option = {
                    url: common.serviceUrls.URL_INVT_ACCOUNT.replace(':uid', user.uid),
                    headers: {
                        "content-type": 'application/json',
                        "cookie": cookie
                    },
                    method: 'post',
                    body: JSON.stringify(_data)
                };
                imp.proxy(option, (proxyErr, proxyData) => {
                    user['InvtAccount'] = proxyData;
                    callback(proxyErr, proxyData);
                })
            },
            function(_account, callback) {
                const _data = {
                    "currency": "HKD",
                    "amount": 100000
                };
                const option = {
                    url: common.serviceUrls.URL_INVT_CASHIN.replace(':uid', user.uid).replace(':accid', _account.id),
                    headers: {
                        "content-type": 'application/json',
                        "cookie": cookie
                    },
                    method: 'post',
                    body: JSON.stringify(_data)
                };
                imp.proxy(option, (proxyErr, proxyData) => {
                    callback(proxyErr, proxyData);
                })
            },
            function(_account, callback) {
                const _data = {
                    "currency": "HKD",
                    "amount": 100000
                };
                const option = {
                    url: common.serviceUrls.URL_DEFAULT_ACCOUNT.replace(':uid', user.uid),
                    headers: {
                        "content-type": 'application/json',
                        "cookie": cookie
                    },
                    method: 'get'
                };
                imp.proxy(option, (proxyErr, proxyData) => {
                    callback(proxyErr, proxyData);
                })
            }
        ],
        // optional callback
        function(err, results) {
            if (err) {
                cb(err, user);
            } else {
                user.updateAttribute('inited', true, (err, instance) => {
                    cb(err, user);
                });
            }
        });
}



imp.kick_mult_login = (model, uid, token) => {
    model.app.models.AccessToken.find({
        where: {
            userId: uid
        },
        order: "created DESC"
    }, function(err, user) {
        var log_out = false;
        console.log('kick token err:',err);
        if (user.length > 1) {
            for (var i = 0; i < user.length; i++) {
                // 将前面已登录的token全部过期
                // console.log('user all tokens----:',user[i].id);
                if (user[i].id !== token) {
                    var myDate = new Date();
                    myDate.setTime(0);
                    user[i].updateAttribute('created', myDate);
                    log_out = true;
                    // console.log("kick token:",user[i].id);
                }
            }
            // var newDate = new Date();
            // var kick_msg = {
            //         target: {
            //             uid: [
            //                 uid
            //             ]
            //         },
            //         content: {
            //             action: "kick_out"
            //         },
            //         create_time: newDate.getTime(),
            //         owner: "user_center"
            //     }
            // if(log_out) {
            //     imp.sendMsg(kick_msg);
            // }
        }
    });
}

//修改model的disable字段为false
imp.set_user_disable = (model, _uid, name, cb) => {
    model.findOne({
        where: {
            uid: _uid
        }
    }, function(err, user) {
        if (err) {
            return cb(err);
        }
        if (!user) {
            return cb({
                "statusCode": 401,
                "name": "Error",
                "message": name + " No such user id",
                "status": 401,
                "code": "INVALID_USER"
            });
        }
        user.disable = true;
        user.save((err3, data3) => {
            if (err3) {
                return cb(err3);
            }
            // console.log('save data', data3);
            return cb(null, data3);
        });
    });
}

//同步资金
imp.sync_positions = (uid, cookie, url1, url2) => {
    async.waterfall([
        function(callback) {
            const option = {
                url: url1.replace(':uid', uid),
                headers: {
                    "content-type": 'application/json',
                    "cookie": cookie
                },
                method: 'get'
            };
            imp.proxy(option, (proxyErr, proxyData) => {
                if (proxyErr) {
                    console.log("proxyErr:", proxyErr);
                }
                callback(proxyErr, proxyData);
            });
        },
        function(data, callback) {
            if (!data) {
                callback(null, data);
                return;
            }
            const option = {
                url: url2.replace(':uid', uid).replace(':accid', data.id).replace('portfolio', 'sync_cashflow'),
                headers: {
                    "content-type": 'application/json',
                    "cookie": cookie
                },
                method: 'post'
            };
            imp.proxy(option, (proxyErr, proxyData) => {
                if (proxyErr) {
                    console.log("proxyErr:", proxyErr);
                }
                callback(proxyErr, proxyData);
            });
        }
    ], function(err, results) {
        if (err) {
            console.log("err:", err);
        } else {
            console.log("result:", results);
        }
    });
}

//发消息到通知系统
imp.sendMsg = (msg) => {
    const option = {
        url: common.envHost[process.env.env] + '/v1/notifications/messages',
        headers: {
            "content-type": 'application/json',
        },
        body: JSON.stringify(msg),
        method: 'post'
    };
    imp.proxy(option, (proxyErr, proxyData) => {
        console.log("proxyErr:", proxyErr, proxyData);
    });
}

//发短信到通知系统
imp.sendSMS = (sms,cb) => {
    var url = common.envHost[process.env.env] + '/api/v1/notifications/sms_messages/persist';
    imp.Ppost(url,null,JSON.stringify(sms),(err,data)=>{
        console.log('err,data',err,data);
        return cb(err, data);
    })
}


//发邮件到通知系统
imp.sendEmailNoti = (mail,cb) => {
    var url = common.envHost[process.env.env] + '/api/v1/notifications/email_messages/persist';
    imp.Ppost(url,null,JSON.stringify(mail),(err,data)=>{
        return cb(err, data);
    })
}


//康宏的密码校验规则-----------
imp.passwordVerify = function(password) {
    var p = new Promise(function(resolve, reject) {
        let strength = 0;
        if (password.length >= 8 && password.length <= 16) {
            if (password.match(/[•€£¥ `]/)) {
                reject(Errs.password_format);
            }
            if (password.match(/^\d+$/)) {
                reject(Errs.password_format);
            }
            if (password.match(/[a-z]+/)) {
                strength++;
            }
            if (password.match(/[A-Z]+/)) {
                strength++;
            }
            if (password.match(/[-/:;\(\)$&@"\.,\?!'\[\]\{\}#%\^\*\+=_\\|~<>]+/)) {
                strength++;
            }
        } else {
            reject(Errs.password_format);
        }
        if (strength < 1) {
            reject(Errs.password_format);
        }
        resolve();
    });
    return p;
}

//邮箱校验规则
imp.emailFormatVerify = function(email) {
    var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
    return re.test(email);
}


//redis 查找验证码
imp.redisFindCode = function (key) {
    var p = new Promise(function(resolve,reject) {
        redis.get(key,function(err,result) {
            if(err) {
                reject(err);
            }
            if(result) {
                resolve(result);
            } else {
                reject();
            }
        })
    });
    return p;
}

//代理GET
imp.Pget = (url,header, cb) => {
    superagent.get(url)
    .end(function(err, pres) {
        if (pres) {
            cb(err, pres.body);
        } else {
            cb(err);
        }
    });
}

//代理POST
imp.Ppost = (url,header,body, cb) => {
    superagent.post(url)
    .set('Content-Type', 'application/json')
    .send(body)
    .end(function(err, pres) {
        if (pres) {
            cb(err, pres.body);
        } else {
            cb(err);
        }
    });
}

//代理POST
imp.Pput = (url,header,body, cb) => {
    superagent.put(url)
    .set('Content-Type', 'application/json')
    .send(body)
    .end(function(err, pres) {
        if (pres) {
            cb(err, pres.body);
        } else {
            cb(err);
        }
    });
}