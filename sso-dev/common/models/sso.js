'use strict';
const g = require('loopback/lib/globalize');
const AliMNS = require('ali-mns');
const debug = require('debug')('loopback:user');
const util = require('../util');
const Errs = require('../errors');
const common = require('../common');
const app = require('../../server/server');
const domain = app.get('config_domain');
const product = app.get('config_product');
const dingding = app.get('config_ding_post')
const utils = require('loopback/lib/utils');
const ipx = require('../read_ipdb');
const async = require('async');
var captchapng = require('captchapng');
var cookie = require('cookie');
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
try {
    ipx.load(process.env.ipdbDir + "/1707ipdb.dat")
} catch (e) {
    console.log(e);
}
const URL_DEFAULT_ACCOUNT = common.serviceUrls.URL_DEFAULT_ACCOUNT;
const URL_DEFAULT_PORTFOLIO = common.serviceUrls.URL_DEFAULT_PORTFOLIO;

module.exports = function(Sso) {
    //Will make sso.save failed when saving sso.locked=true if name is not unique.
    // Sso.validatesUniquenessOf('name', {
    //     message: 'name is not unique'
    // });

    Sso.definition.properties.create_time.default = function() {
        return Math.round(new Date().getTime() / 1000);
    };
    Sso.definition.properties.update_time.default = function() {
        return Math.round(new Date().getTime() / 1000);
    };

    Sso.beforeRemote('create', function(context, unused, next) {
        console.log('Putting in the car key, starting the engine.');
        console.log(`req body`, context.req.body);
        let user_type = common.UserType.Normal;
        if (context.req.body['tester'] === true) {
            user_type = common.UserType.Tester;
        }
        var _product = context.req.headers.host;

        util.generateUid(user_type, (err, uid) => {
            const salt = util.generateSalt();
            const pwd = util.hashPassword(context.req.body['password'], salt);
            context.req.body['uid'] = uid;
            context.req.body['type'] = user_type;
            context.req.body['oid'] = 1;
            context.req.body['pid'] = 1;
            context.req.body['password'] = Buffer.from(pwd, 'hex').toString('hex');
            context.req.body['activated'] = true;
            context.req.body['salt'] = Buffer.from(salt, 'hex').toString('hex');
            context.req.body['product'] = _product;
            next();
        })
    })

    Sso.beforeRemote('prototype.patchAttributes', function(context, unused, next) {
        Sso.findOne({
            where: {
                uid: context.req.params['id']
            }
        }, function(err, user) {
            if (err) {
                return next(err)
            }

            if (!user) {
                return next(Errs.password_wrong)
            }
            if (context.req.body['oldPassword'] || context.req.body['password']) {
                const _pwd = util.hashPassword(context.req.body['oldPassword'], Buffer.from(user.salt, 'hex'));
                if (Buffer.from(_pwd, 'hex').toString('hex') === user.password) {
                    const salt = util.generateSalt();
                    const pwd = util.hashPassword(context.req.body['password'], salt);
                    context.req.body['password'] = Buffer.from(pwd, 'hex').toString('hex');
                    context.req.body['salt'] = Buffer.from(salt, 'hex').toString('hex');
                    context.req.body['pass_reset_time'] = Math.round(new Date().getTime() / 1000);
                    context.req.body['locked'] = 0; //unlock user
                    next();
                } else {
                    return next(Errs.password_wrong)
                }
            } else {
                next();
            }

        })
    });

    /**
     * Login a user by with the given `credentials`.
     *
     * ```js
     *    User.login({"uid": "foo", password: "bar"}, function (err, token) {
     *      console.log(token.id);
     *    });
     */

    Sso.beforeRemote('login', function(context, unused, next) {
        async.waterfall([
                function(callback) {
                     console.log('callback5---');
                    Sso.findOne({
                        where: {
                            uid: context.req.body['uid']
                        }
                    }, function(err, user) {
                        if (err) {
                            return callback(err);
                        }
                        if (!user) {
                            return callback(Errs.no_user);
                        }
                        return callback(null,user);
                    });
                },
                function(user,callback) {
                    console.log('callback3---');
                    if (user.whitelist) {
                        console.log('losd2---');
                        var whitelist = user.whitelist.split(";");
                        var isWhite = false;
                        for (var i = 0; i < whitelist.length; i++) {
                            if (whitelist[i] === context.req.ip) {
                                isWhite = true;
                                break;
                            }
                        }
                        if (isWhite) {
                            return callback();
                        } else {
                            return callback(Errs.not_white_ip);
                        } //end of if
                    } else {
                        return callback();
                    }
                    
                },
                function(callback) {
                    console.log('callback4---');
                    context.req.body['hostname'] = context.req.hostname;
                    context.req.body['remote_ip'] = context.req.ip;
                    var _location = ipx.findSync(context.req.ip);
                    for (var i = _location.length - 1; i >= 0; i--) {
                        if (!context.req.body['location']) {
                            context.req.body['location'] = _location[i];
                        } else {
                            context.req.body['location'] = context.req.body['location'] + ',' + _location[i];
                        }
                    }
                    return callback();
                },
                function(callback) {
                    //check image code
                    console.log('callback2----',context.req.headers.cookie);
                    var cookies = '';
                    if(context.req.headers.cookie) {
                        cookies = cookie.parse(context.req.headers.cookie);
                    }
                    console.log('sessionId--imgcode', cookies['sessionId'], context.req.body['imgcode'])
                    if (cookies['sessionId'] && context.req.body['imgcode']) {
                        redis.get(cookies['sessionId'], function(err, result) {
                            console.log('result---', result);
                            if (err) {
                                console.log('err-----', err);
                                return callback(Errs.imgcode_wrong);
                            }
                            if (!result) {
                                console.log('err2-----');
                                return callback(Errs.imgcode_wrong);
                            }
                            console.log('err3-----');
                            if (result === context.req.body['imgcode']) {
                                console.log('err4-----');
                                return callback();
                            } else {
                                console.log('err5-----');
                                return callback(Errs.imgcode_wrong);
                            }
                        });
                    } else {
                        return callback();
                    }
                    // 
                }
            ],function(err, results) {
                 console.log('callbackfinal---');
                return next(err, results);
            });
    });

    Sso.login = function(credentials, include, _fn) {
        console.log('beferoe--',credentials);
        var self = this;
        const loginLog = {
            uid: credentials.uid,
            password: credentials.password,
            product: 'todo',
            ip: credentials.remote_ip,
            location: credentials.location,
            platform: 'todo'
        };
        if (typeof include === 'function') {
            _fn = include;
            include = undefined;
        }
        console.log('login lhost ', credentials.hostname);
        _fn = _fn || utils.createPromiseCallback();

        const fn = (err, data, reset_time) => {
            if (err) {
                loginLog['successful'] = false;
            } else {
                loginLog['successful'] = true;
            }
            Sso.app.models.LoginHistory.create(loginLog, (_err, _log) => {
                if (_err) {
                    console.log('loginLog', _err);
                }
                if (err && err.code == 'LOGIN_FAILED') {
                    let timeWindow = Math.round(new Date().getTime() / 1000) - (60 * 60);
                    if (reset_time) {
                        if (reset_time > timeWindow) { //刚修改完密码以修改密码时间为准
                            timeWindow = reset_time;
                        }
                    }
                    Sso.app.models.LoginHistory.find({
                        where: {
                            uid: credentials.uid,
                            create_time: {
                                gt: timeWindow
                            }
                        },
                        order: "create_time DESC",
                        limit: 5
                    }, (logErr, logs) => {
                        if (logErr) {
                            console.log('lock logErr', logErr);
                            _fn(err, data);
                        } else {
                            let counter = 0;
                            for (var i = 0; i < logs.length; i++) {
                                if (logs[i].successful) {
                                    break;
                                }
                                counter++;
                            }
                            err.data = {
                                counter: counter,
                                all: 5
                            };
                            if (counter >= 5) {
                                self.findOne({
                                    where: {
                                        uid: credentials.uid
                                    }
                                }, function(err2, user2) {
                                    if (err2 || !user2) {
                                        console.log('lock err2', err2);
                                        _fn(err, data);
                                    } else {
                                        user2.locked = true;
                                        user2.save((err3, data3) => {
                                            if (err3) {
                                                console.log('lock err3', err3);
                                            }
                                            _fn(err, data);
                                        })
                                    }
                                })
                            } else {
                                _fn(err, err.imgcode);
                            }
                        }
                    })
                } else {
                    _fn(err, data);
                }
            })
        }

        include = (include || '');
        if (Array.isArray(include)) {
            include = include.map(function(val) {
                return val.toLowerCase();
            });
        } else {
            include = include.toLowerCase();
        }

        var realmDelimiter;
        // Check if realm is required
        var realmRequired = !!(self.settings.realmRequired ||
            self.settings.realmDelimiter);
        if (realmRequired) {
            realmDelimiter = self.settings.realmDelimiter;
        }

        var query = self.normalizeCredentials(credentials, realmRequired,
            realmDelimiter);

        if (realmRequired && !query.realm) {
            var err1 = new Error(g.f('{{realm}} is required'));
            err1.statusCode = 400;
            err1.code = 'REALM_REQUIRED';
            fn(err1);
            return fn.promise;
        }
        // if (!query.email && !query.username) {
        //     var err2 = new Error(g.f('{{username}} or {{email}} is required'));
        //     err2.statusCode = 400;
        //     err2.code = 'USERNAME_EMAIL_REQUIRED';
        //     fn(err2);
        //     return fn.promise;
        // }
        console.log('reqir----',query);
        if (!query.uid && !query.name) {
            fn(Errs.no_user);
            return fn.promise;
        }


        query.activated = true;
        query.locked = false;

        self.findOne({
            where: query
        }, function(err, user) {
            function tokenHandler(err, token) {
                if (err) return fn(err);
                if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
                    // NOTE(bajtos) We can't set token.user here:
                    //  1. token.user already exists, it's a function injected by
                    //     "AccessToken belongsTo User" relation
                    //  2. ModelBaseClass.toJSON() ignores own properties, thus
                    //     the value won't be included in the HTTP response
                    // See also loopback#161 and loopback#162
                    token.__data.user = user;
                }
                fn(err, token);

            }

            if (err) {
                debug('An error is reported from User.findOne: %j', err);
                fn(Errs.login_unknown);
                return fn.promise;
            } else if (user) {
                // const app = require('../../server/server');
                // const product = app.get('config_product');
                // if (!product.accept[user.product]) {
                //     fn(defaultError);
                //     return fn.promise;
                // }
                if (!credentials.password) {
                    fn(Errs.password_wrong, null, user.pass_reset_time);
                    return fn.promise;
                }
                user.hasPassword(credentials.password, function(err, isMatch) {
                    if (err) {
                        debug('An error is reported from User.hasPassword: %j', err);
                        fn(Errs.login_unknown, null, user.pass_reset_time);
                        return fn.promise;
                    } else if (isMatch) {
                        if (self.settings.emailVerificationRequired && !user.emailVerified) {
                            // Fail to log in if email verification is not done yet
                            debug('User email has not been verified');
                            err = new Error(g.f('login failed as the email has not been verified'));
                            err.statusCode = 401;
                            err.code = 'LOGIN_FAILED_EMAIL_NOT_VERIFIED';
                            fn(err);
                            return fn.promise;
                        } else {
                            credentials.ttl = process.env.loginTTL; //sec
                            if (user.createAccessToken.length === 2) {
                                user.createAccessToken(credentials.ttl, tokenHandler);
                            } else {
                                user.createAccessToken(credentials.ttl, credentials, tokenHandler);
                            }

                            if (user.type !== common.UserType.Tester && dingding && dingding.post_url) {
                                const msg = '用户 “' + credentials.who + '” 从 “' + credentials.where + '” 登录成功，uid：' + query.uid;
                                sendDingMsg("用户登录报告", msg);
                            }

                        }
                    } else {
                        debug('The password is invalid for user %s', query.email || query.username);
                        fn(Errs.password_wrong, null, user.pass_reset_time);
                        if (user.type !== common.UserType.Tester && dingding && dingding.post_url) {
                            const msg = '用户 “' + credentials.who + '” 从 “' + credentials.where + '” 登录失败，密码错误，uid：' + query.uid;
                            sendDingMsg("用户登录报告", msg);
                        }
                        return fn.promise;
                    }
                });
            } else {
                debug('No matching record is found for user %s', query.email || query.username);
                fn(Errs.locked_user);
                return fn.promise;
            }
        });
        return fn.promise;
    };



    Sso.remoteMethod(
        'login', {
            description: 'Login a user with username/email and password.',
            accepts: [{
                arg: 'credentials',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            }, {
                arg: 'include',
                type: ['string'],
                http: {
                    source: 'query'
                },
                description: 'Related objects to include in the response. ' +
                    'See the description of return value for more details.'
            }],
            returns: {
                arg: 'accessToken',
                type: 'object',
                root: true,
                description: g.f('The response body contains properties of the {{AccessToken}} created on login.\n' +
                    'Depending on the value of `include` parameter, the body may contain ' +
                    'additional properties:\n\n' +
                    '  - `user` - `U+007BUserU+007D` - Data of the currently logged in user. ' +
                    '{{(`include=user`)}}\n\n'),
            },
            http: {
                verb: 'post'
            },
        }
    );



    Sso.afterRemote('login', function(context, userInstance, next) {
        console.log('> user.afterRemote triggered');
        const app = require('../../server/server');
        const domain = app.get('config_domain');
        if (userInstance) {
            const sessionCookie = 'access_token=' + userInstance.id + ";domain=" + domain.host + ";path=/;Max-Age=" + 60 * 60 + ";HttpOnly";

            // context.res.setHeader("Set-Cookie", [sessionCookie]);
            context.res.cookie('access_token', userInstance.id, {
                // domain: domain.host,
                path: '/',
                'Max-Age': 60 * 60,
                httpOnly: true,
                signed: true
            })
            console.log('newcookie---', context.res._headers['set-cookie']);
            util.kick_mult_login(Sso, userInstance.userId, userInstance.id);
            //康宏登录后同步账户
            if (context.req.hostname.indexOf('cissecurities') !== -1 || context.req.hostname.indexOf('convoy') !== -1) {
                util.sync_positions(userInstance.userId, context.res._headers['set-cookie'], URL_DEFAULT_ACCOUNT, URL_DEFAULT_PORTFOLIO);
            }
            // const aliAcc = new AliMNS.Account(
            //     '1075072801473341',
            //     'LTAI4z9qMLFKlRK3',
            //     'O92b38RZsr0joyarDVnHC3NmE8pHbZ'
            // );
            // let region = new AliMNS.Region('shanghai');
            // let topic = new AliMNS.Topic( process.env.env +'-noti-user', aliAcc, region);
            // topic.publishP(JSON.stringify({
            //     msg: '账户已从别处登录',
            //     code: 401
            // }), true, 'uid.'+userInstance.userId).then(console.log, console.error);
            // Sso.app.models.AccessToken.find({
            //     where: {
            //         userId: userInstance.userId
            //     },
            //     order: "create_time DESC"
            // }, function(err, user) {
            //     if (user.length > 1) {
            //         for (var i = 0; i < user.length; i++) {
            //             // 将前面已登录的token全部过期
            //             if (user[i].id !== userInstance.id) {
            //                 var myDate = new Date();
            //                 myDate.setTime(0);
            //                 user[i].updateAttribute('created', myDate);
            //                 // console.log("user:",user[i]);
            //             }
            //         }
            //     }
            // });
        }

        next();
    });

    /**
     * Compare the given `password` with the users hashed password.
     *
     * @param {String} password The plain text password
     * @callback {Function} callback Callback function
     * @param {Error} err Error object
     * @param {Boolean} isMatch Returns true if the given `password` matches record
     * @promise
     */

    Sso.prototype.hasPassword = function(plain, fn) {
        fn = fn || utils.createPromiseCallback();
        if (this.password && plain) {
            const _pwd = util.hashPassword(plain, Buffer.from(this.salt, 'hex'));
            if (Buffer.from(_pwd, 'hex').toString('hex') === this.password) {
                fn(null, true);
            } else {
                fn(null, false);
            }
        } else {
            fn(null, false);
        }
        return fn.promise;
    };

    /*!
     * Hash the plain password
     */
    Sso.hashPassword = function(plain) {
        // this.validatePassword(plain);
        // var salt = bcrypt.genSaltSync(this.settings.saltWorkFactor || SALT_WORK_FACTOR);
        //return bcrypt.hashSync(plain, salt);
        return plain;
    };

    /**
     * Normalize the credentials
     * @param {Object} credentials The credential object
     * @param {Boolean} realmRequired
     * @param {String} realmDelimiter The realm delimiter, if not set, no realm is needed
     * @returns {Object} The normalized credential object
     */
    Sso.normalizeCredentials = function(credentials, realmRequired, realmDelimiter) {
        var query = {};
        credentials = credentials || {};
        console.log('credentials--',credentials,realmRequired,realmDelimiter);
        if (!realmRequired) {
            // if (credentials.email) {
            //     query.email = credentials.email;
            // } else if (credentials.username) {
            //     query.username = credentials.username;
            // }
            query.uid = credentials.uid;
        } else {
            if (credentials.realm) {
                query.realm = credentials.realm;
            }
            var parts;
            if (credentials.email) {
                parts = splitPrincipal(credentials.email, realmDelimiter);
                query.email = parts[1];
                if (parts[0]) {
                    query.realm = parts[0];
                }
            } else if (credentials.name) {
                parts = splitPrincipal(credentials.name, realmDelimiter);
                query.name = parts[1];
                if (parts[0]) {
                    query.realm = parts[0];
                }
            }
        }
        return query;
    };

    function splitPrincipal(name, realmDelimiter) {
        var parts = [null, name];
        if (!realmDelimiter) {
            return parts;
        }
        var index = name.indexOf(realmDelimiter);
        if (index !== -1) {
            parts[0] = name.substring(0, index);
            parts[1] = name.substring(index + realmDelimiter.length);
        }
        return parts;
    };

    function sendDingMsg(title, text) {
        const dingdingMsg = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": text
            }
        };
        const option = {
            url: dingding.post_url,
            headers: {
                "content-type": 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(dingdingMsg)
        };
        util.proxy(option, (proxyErr, proxyData) => {
            console.log(proxyErr);
            console.log(proxyData);
        })
    }

    Sso.checkUser = function(_ids, cb) {
        console.log('_ids', _ids);
        if (_ids) {
            if (util.isEmail(_ids)) {
                Sso.app.models.EmailUser.find({
                    where: {
                        email: _ids
                    },
                    order: "create_time DESC"
                }, function(err, user) {
                    cb(err, user[0]);
                })
            } else {
                Sso.find({
                    where: {
                        name: _ids,
                        activated: true
                    }
                }, function(err, user) {
                    cb(err, user[0]);
                })
            }
        } else {
            cb(null, {});
        }
    };

    Sso.remoteMethod('checkUser', {
        accepts: {
            arg: 'ids',
            type: 'string',
            'http': {
                source: 'query'
            }
        },
        returns: {
            root: true,
            type: 'Object'
        },
        http: {
            verb: 'get'
        }
    });


    Sso.tokenRefresh = function(req, cb) {
        console.log('tokenRefresh');
        cb(null);
    };

    Sso.remoteMethod('tokenRefresh', {
        accepts: {
            arg: 'req',
            type: 'string'
        },
        returns: {
            root: true,
            type: 'Object'
        },
        http: {
            verb: 'get'
        }
    });

    Sso.addWhiteIP = function(credentials, cb) {
        var re = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/; //正则表达式     
        if (!re.test(credentials.ip)) {
            return cb(Errs.worng_ip_format);
        }
        if (RegExp.$1 > 255 || RegExp.$2 > 255 || RegExp.$3 > 255 || RegExp.$4 > 255) {
            return cb(Errs.worng_ip_format);
        }

        Sso.findOne({
            where: {
                uid: credentials.uid
            }
        }, function(err, user) {
            if (err) {
                return cb(err);
            }
            if (!user) {
                return cb(Errs.no_user);
            }

            var new_white = '';
            if (user.whitelist) {
                var IPs = user.whitelist.split(";");
                for (var i = 0; i < IPs.length; i++) {
                    if (IPs[i] === credentials.ip) { //已在白名单
                        return cb();
                    }
                }
                new_white = user.whitelist + ';' + credentials.ip;
            } else {
                new_white = credentials.ip;
            }
            user.updateAttribute('whitelist', new_white, function(err) {
                cb(err);
            });
        }); //end of findOne
    };

    Sso.remoteMethod('addWhiteIP', {
        accepts: {
            arg: 'credentials',
            type: 'object',
            required: true,
            http: {
                source: 'body'
            }
        },
        returns: {
            root: true,
            type: 'Object'
        },
        http: {
            verb: 'post'
        }
    });

    Sso.deleteWhiteIP = function(credentials, cb) {
        Sso.findOne({
            where: {
                uid: credentials.uid
            }
        }, function(err, user) {
            if (err) {
                return cb(err);
            }
            if (!user) {
                return cb(Errs.no_user);
            }

            var new_white = '';
            if (user.whitelist) {
                var IPs = user.whitelist.split(";");
                var inList = false;
                for (var i = 0; i < IPs.length; i++) {
                    if (IPs[i] === credentials.ip) { //已在白名单
                        IPs.splice(i, 1);
                        inList = true;
                        break;
                    }
                }
                if (!inList) { //不在白名单
                    return cb();
                }
                new_white = IPs.join(';');
            } else {
                return cb();
            }
            user.updateAttribute('whitelist', new_white, function(err) {
                cb(err);
            });
        }); //end of findOne
    };

    Sso.remoteMethod('deleteWhiteIP', {
        accepts: {
            arg: 'credentials',
            type: 'object',
            required: true,
            http: {
                source: 'body'
            }
        },
        returns: {
            root: true,
            type: 'Object'
        },
        http: {
            verb: 'post'
        }
    });

    Sso.GroupUidList = function(filt, cb) {
        if (!filt.groups) {
            return cb(Errs.group_required);
        }
        var oid_map = {
            AdminAqumon: 1,
            AdminHuarun: 2,
            AdminGuodu: 3,
            AdminConvoy: 4
        }
        var returnJson = new Array();
        async.reduce(filt.groups, returnJson, function(memo, item, callback) {
            // console.log('items',item);
            Sso.app.models.AdminUser.find({
                where: {
                    oid: oid_map[item]
                },
                fields: {
                    uid: true
                }
            }, function(err, user) {
                memo = memo.concat(user);
                callback(err, memo);
                // console.log('admin user',memo,user);
            });
        }, function(err, result) {
            // console.log('resutl',JSON.stringify(result));
            return cb(err, result);
        });

    };
    Sso.remoteMethod('GroupUidList', {
        accepts: {
            arg: 'groups',
            type: 'object',
            required: true,
            'http': {
                source: 'body'
            }
        },
        returns: {
            root: true,
            type: 'Object'
        },
        http: {
            verb: 'post'
        }
    });

    Sso.pagelist = function(filter, page, start, limit, cb) {
        var where = {
            disable: 0
        };
        var filter_map = {
            order: ['create_time DESC'],
            limit: limit,
            offset: start,
        };
        if (filter) {
            var fils = filter.split('-');
            for (var i = fils.length; i--;) {
                var filters = fils[i].split('::');
                if (filters[1]) {
                    if (filters[0] === 'oid') {
                        where[filters[0]] = filters[1];
                    } else {
                        where[filters[0]] = {
                            like: '%' + filters[1] + '%'
                        };
                    }
                }
            }
        }
        filter_map['where'] = where;
        console.log("filter_map----", filter_map);
        Sso.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            Sso.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    Sso.remoteMethod('pagelist', {
        accepts: [{
            arg: 'filter',
            type: 'string'
        }, {
            arg: 'page',
            type: 'number'
        }, {
            arg: 'start',
            type: 'number'
        }, {
            arg: 'limit',
            type: 'number'
        }],
        http: {
            path: '/pagelist',
            verb: 'get'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });

    Sso.imgcode = function(req, cb) {
        console.log('req.session.captcha---', req.session.captcha);
        var cookies = cookie.parse(req.headers.cookie);
        if (cookies['sessionId']) {
            console.log('req---', cookies['sessionId']);
            var randomcode = Math.random().toString().slice(-4);
            console.log('eamdom--', randomcode);
            redis.set(cookies['sessionId'], randomcode);
            var p = new captchapng(80, 30, randomcode); // 宽,高,数字验证码
            p.color(0, 0, 0, 0); // First color: background (red, green, blue, alpha) 
            p.color(80, 80, 80, 255); // Second color: paint (red, green, blue, alpha) 
            var img = p.getBase64();
            var imgbase64 = new Buffer(img, 'base64');
            return cb(null, imgbase64);
        } else {
            return cb('no session.');
        }
    };
    Sso.remoteMethod('imgcode', {
        accepts: [{
            arg: 'req',
            type: 'object',
            http: {
                source: 'req'
            }
        }],
        http: {
            path: '/imgcode',
            verb: 'get'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });
    //重载User model的修改密码函数
    // Sso.changePassword = function(userId, oldPassword, newPassword, options, cb) {
    //     if (cb === undefined && typeof options === 'function') {
    //         cb = options;
    //         options = undefined;
    //     }
    //     cb = cb || utils.createPromiseCallback();

    //     // Make sure to use the constructor of the (sub)class
    //     // where the method is invoked from (`this` instead of `User`)
    //     this.findById(userId, options, (err, inst) => {
    //         if (err) return cb(err);

    //         if (!inst) {
    //             const err = new Error(`User ${userId} not found`);
    //             Object.assign(err, {
    //                 code: 'USER_NOT_FOUND',
    //                 statusCode: 401,
    //             });
    //             return cb(err);
    //         }
    //         var _newPassword = util.hashPassword(newPassword, Buffer.from(inst.salt, 'hex'));
    //         _newPassword = Buffer.from(_newPassword, 'hex').toString('hex');
    //         inst.changePassword(oldPassword, _newPassword, options, cb);
    //     });

    //     return cb.promise;
    // };

    //转发给open-account，做权限控制
    //初审-----------------------------------------
    Sso.appliFirst = function(req,region,result,filter,page,start,limit,cb) {
        var url;
        var list = '';
        if(result === '1') { list = list +'&result=first_pass'; }
        else if(result === '2') { list = list +'&result=first_reject'; }
        else if(result === '12') { list = list +'&result=first_pass_reject'; }
        else {
            return cb(null,{});
        }
        if(page) { list = list +'&page=' + page; }
        if(start) { list = list +'&start=' + start; }
        if(limit) { list = list +'&limit=' + limit; }
        if(region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/pagelist?filter=' +filter + list;
        } else if (region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/pagelist?filter=' +filter + list;
        } else {
            return cb(null,null);
        }
        util.Pget(url, null,(err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliFirst', {
        description: '获取初审名单',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'region', type: 'string', 'http': { source: 'query' }},
        {arg: 'result', type: 'string', 'http': { source: 'query' }},
        {arg: 'filter', type: 'string', 'http': { source: 'query' }},
        {arg: 'page', type: 'number', 'http': { source: 'query' }},
        {arg: 'start', type: 'number', 'http': { source: 'query' }},
        {arg: 'limit', type: 'number', 'http': { source: 'query' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/first', verb: 'get', }
    });
    //初审
    Sso.appliFirstApproval = function(req,body,cb) {
        if(!body.region || !body.aid ||!body.result) {
            return cb(null,null);
        }
        var url;
        var jsonBody = {
            first_operator:body.operator,
            first_remark:body.comment
        };
        if(body.region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/'+body.aid;
        } else if (body.region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/'+body.aid;
        } else {
            return cb(null,null);
        }
        if(body.result === 'pass') {
            jsonBody.status = 2000;
        } else if(body.result === 'reject') {
            jsonBody.status = 21000;
        }
        util.Pput(url,null, jsonBody,(err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliFirstApproval', {
        description: '初审结果',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'body', type: 'object', 'http': { source: 'body' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/first/approval', verb: 'post', }
    });

    //复审-----------------------------------------
    Sso.appliReview = function(req,region,result,filter,page,start,limit,cb) {
        var url;
        var list = '';
        if(result === '1') { list = list +'&result=review_pass'; }
        else if(result === '2') { list = list +'&result=review_reject'; }
        else if(result === '12') { list = list +'&result=review_pass_reject'; }
        else {
            return cb(null,{});
        }
        if(page) { list = list +'&page=' + page; }
        if(start) { list = list +'&start=' + start; }
        if(limit) { list = list +'&limit=' + limit; }
        if(region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/pagelist?filter='+filter + list;
        } else if (region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/pagelist?filter='+filter + list;
        } else {
            return cb(null,null);
        }
        util.Pget(url,null, (err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliReview', {
        description: '获取复审名单',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'region', type: 'string', 'http': { source: 'query' }},
        {arg: 'result', type: 'string', 'http': { source: 'query' }},
        {arg: 'filter', type: 'string', 'http': { source: 'query' }},
        {arg: 'page', type: 'number', 'http': { source: 'query' }},
        {arg: 'start', type: 'number', 'http': { source: 'query' }},
        {arg: 'limit', type: 'number', 'http': { source: 'query' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/review', verb: 'get', }
    });
    //复审
    Sso.appliReviewApproval = function(req,body,cb) {
        if(!body.region || !body.aid ||!body.result) {
            return cb(null,null);
        }
        var url;
        var jsonBody = {
            review_operator:body.operator,
            review_remark:body.comment
        };
        if(body.region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/'+body.aid;
        } else if (body.region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/'+body.aid;
        } else {
            return cb(null,null);
        }
        if(body.result === 'pass') {
            jsonBody.status = 3000;
        } else if(body.result === 'reject') {
            jsonBody.status = 22000;
        }
        util.Pput(url,null, jsonBody,(err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliReviewApproval', {
        description: '复审结果',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'body', type: 'object', 'http': { source: 'body' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/review/approval', verb: 'post', }
    });
    //终审-----------------------------------------
    Sso.appliFinal = function(req,region,result,filter,page,start,limit,cb) {
        var url;
        var list = '';
        if(result === '1') { list = list +'&result=final_pass'; }
        else if(result === '2') { list = list +'&result=final_reject'; }
        else if(result === '12') { list = list +'&result=final_pass_reject'; }
        else {
            return cb(null,{});
        }
        if(page) { list = list +'&page=' + page; }
        if(start) { list = list +'&start=' + start; }
        if(limit) { list = list +'&limit=' + limit; }
        if(region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/pagelist?filter='+filter + list;
        } else if (region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/pagelist?filter='+filter + list;
        } else {
            return cb(null,null);
        }
        util.Pget(url,null, (err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliFinal', {
        description: '获取初审名单',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'region', type: 'string', 'http': { source: 'query' }},
        {arg: 'result', type: 'string', 'http': { source: 'query' }},
        {arg: 'filter', type: 'string', 'http': { source: 'query' }},
        {arg: 'page', type: 'number', 'http': { source: 'query' }},
        {arg: 'start', type: 'number', 'http': { source: 'query' }},
        {arg: 'limit', type: 'number', 'http': { source: 'query' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/final', verb: 'get', }
    });
    //终审
    Sso.appliFinalApproval = function(req,body,cb) {
        if(!body.region || !body.aid ||!body.result) {
            return cb(null,null);
        }
        var url;
        var jsonBody = {
            final_operator:body.operator,
            final_remark:body.comment
        };
        if(body.region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/'+body.aid;
        } else if (body.region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/'+body.aid;
        } else {
            return cb(null,null);
        }
        if(body.result === 'pass') {
            jsonBody.status = 4000;
        } else if(body.result === 'reject') {
            jsonBody.status = 23000;
        }
        util.Pput(url,null, jsonBody, (err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliFinalApproval', {
        description: '终审结果',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'body', type: 'object', 'http': { source: 'body' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/final/approval', verb: 'post', }
    });
    //IB审-----------------------------------------
    Sso.appliIB = function(req,region,result,filter,page,start,limit,cb) {
        var url;
        var list = '';
        if(result === '1') { list = list +'&result=ib_pass'; }
        else if(result === '2') { list = list +'&result=ib_reject'; }
        else if(result === '12') { list = list +'&result=ib_pass_reject'; }
        else {
            return cb(null,{});
        }
        if(page) { list = list +'&page=' + page; }
        if(start) { list = list +'&start=' + start; }
        if(limit) { list = list +'&limit=' + limit; }
        if(region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/pagelist?filter='+filter + list;
        } else if (region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/pagelist?filter='+filter + list;
        } else {
            return cb(null,null);
        }
        util.Pget(url,null,  (err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliIB', {
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'region', type: 'string', 'http': { source: 'query' }},
        {arg: 'result', type: 'string', 'http': { source: 'query' }},
        {arg: 'filter', type: 'string', 'http': { source: 'query' }},
        {arg: 'page', type: 'number', 'http': { source: 'query' }},
        {arg: 'start', type: 'number', 'http': { source: 'query' }},
        {arg: 'limit', type: 'number', 'http': { source: 'query' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/ib', verb: 'get', }
    });
    //终审
    Sso.appliIBApproval = function(req,body,cb) {
        if(!body.region || !body.aid ||!body.result) {
            return cb(null,null);
        }
        var url;
        var jsonBody = {
            ib_operator:body.operator,
            ib_remark:body.comment
        };
        if(body.region === 'hk') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationhks/'+body.aid;
        } else if (body.region === 'cn') {
            url = 'http://127.0.0.1:9200/api/v1/users/applications/openaccount/applicationcns/'+body.aid;
        } else {
            return cb(null,null);
        }
        if(body.result === 'pass') {
            jsonBody.status = 10000;
        } else if(body.result === 'reject') {
            jsonBody.status = 24000;
        }
        util.Pput(url,null, jsonBody,(err, data) => {
            return cb(err, data);
        });
    }
    Sso.remoteMethod('appliIBApproval', {
        description: '待IB开户结果',
        accepts: [
        {arg: 'req', type: 'object', 'http': { source: 'req' }},
        {arg: 'body', type: 'object', 'http': { source: 'body' }}
        ],
        returns: { root: true, type: 'Object' },
        http: { path: '/application/ib/approval', verb: 'post', }
    });
};