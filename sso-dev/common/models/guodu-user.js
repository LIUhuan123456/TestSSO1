'use strict';

const util = require('../util');
const utils = require('loopback/lib/utils');
const async = require('async');
const _ = require('lodash');
const common = require('../common');
const g = require('loopback/lib/globalize');
var logger = require('../logger');
const Errs = require('../errors');

const DEFAULT_TTL = 1209600; // 2 weeks in seconds
const DEFAULT_RESET_PW_TTL = process.env.loginTTL;
const DEFAULT_MAX_TTL = 31556926; // 1 year in seconds

const URL_DEFAULT_ACCOUNT = common.serviceUrls.URL_DEFAULT_ACCOUNT;
const URL_DEFAULT_PORTFOLIO = common.serviceUrls.URL_DEFAULT_PORTFOLIO;

const appKey = 'ccdc177b8bcb69260f5176e381046654';
const ipx = require('../read_ipdb');
try {
    ipx.load(process.env.ipdbDir + "/1707ipdb.dat");
} catch (e) {
    console.log(e);
}
module.exports = function(GuoduUser) {
    GuoduUser.disableRemoteMethodByName('patchOrCreate');
    //set filter
    GuoduUser.beforeRemote('*', function(context, unused, next) {
        var _filter_list = ['find', 'findById', 'findOne'];
        var _where_list = ['count'];
        // console.log('context.method.name',context.method.name);
        if (_filter_list.indexOf(context.method.name) !== -1) {
            console.log('filter before modify:', context.args);
            context.args.filter = context.args.filter || {};
            if (context.args.filter.where && Object.keys(context.args.filter.where).length > 0) {
                context.args.filter.where = {
                    and: [context.args.filter.where, {
                        "disable": false,
                        accountId: {
                            neq: '0000000'
                        }
                    }]
                };
            } else {
                context.args.filter.where = {
                    "disable": false,
                    accountId: {
                        neq: '0000000'
                    }
                };
            }
            console.log('filter after modify:', context.args.filter);
            return next();
        }
        if (_where_list.indexOf(context.method.name) !== -1) {
            console.log('where before modify:', context.args);
            context.args.where = context.args.where || {};
            if (context.args.where && Object.keys(context.args.where).length > 0) {
                context.args.where.disable = false;
            } else {
                context.args.where = {
                    "disable": false,
                    accountId: {
                        neq: '0000000'
                    }
                };
            }
            console.log('where after modify:', context.args.where);
            return next();
        }

        return next();
    });
    //check IP whitelist and record ip location
    GuoduUser.beforeRemote('grant', function(context, unused, next) {
        var where = {
            accountId: context.req.body['accountId']
                // token: context.req.body['token']
        };
        GuoduUser.findOne({
            where: where,
            order: "create_time DESC"
        }, function(err, guoduUser) {
            if (err) {
                return next(err);
            }
            if (!guoduUser) {
                return next(Errs.no_user);
            }
            GuoduUser.app.models.Sso.findOne({
                where: {
                    uid: guoduUser.uid
                }
            }, function(err, user) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    return next(Errs.no_user);
                }
                context.req.body['remote_ip'] = context.req.ip;
                var _location = ipx.findSync(context.req.ip);
                for (var i = _location.length - 1; i >= 0; i--) {
                    if (!context.req.body['location']) {
                        context.req.body['location'] = _location[i];
                    } else {
                        context.req.body['location'] = context.req.body['location'] + ',' + _location[i];
                    }
                }
                if (!user.whitelist) {
                    return next();
                }
                var whitelist = user.whitelist.split(";");
                var isWhite = false;
                for (var i = 0; i < whitelist.length; i++) {
                    if (whitelist[i] === context.req.ip) {
                        isWhite = true;
                        break;
                    }
                }
                if (isWhite) {
                    return next();
                } else {
                    return next(Errs.not_white_ip);
                } //end of if (isWhite)
            }); //end of findOne
        }); //end of findOne
    });



    GuoduUser.grant = function(options, cookie, cb) {
        cb = cb || utils.createPromiseCallback();
        var UserModel = GuoduUser.app.models.Sso;
        // var UserModel = this;
        var ttl = UserModel.settings.resetPasswordTokenTTL || DEFAULT_RESET_PW_TTL;
        options = options || {};
        const loginLog = {
            uid: options.uid,
            password: options.password,
            product: 'guodu',
            ip: options.remote_ip,
            location: options.location,
            platform: 'todo',
            additional: JSON.stringify(options)
        };
        const logCb = (err, data) => {
            if (err) {
                loginLog['successful'] = false;
            } else {
                loginLog['successful'] = true;
            }
            GuoduUser.app.models.LoginHistory.create(loginLog, (_err, _log) => {
                if (_err) {
                    console.log('loginLog', _err);
                }
                cb(err, data);
            })
        }

        // if (typeof options.email !== 'string') {
        //     var err = new Error(g.f('Email is required'));
        //     err.statusCode = 400;
        //     err.code = 'EMAIL_REQUIRED';
        //     cb(err);
        //     return cb.promise;
        // }

        // try {
        //     if (options.password) {
        //         UserModel.validatePassword(options.password);
        //     }
        // } catch (err) {
        //     return cb(err);
        // }

        // var where = {};
        // if (options.accountId && options.token) {
        var where = {
            accountId: options.accountId
                // token: options.token
        };
        // }
        // if (options.realm) {
        //     where.realm = options.realm;
        // }
        GuoduUser.findOne({
            where: where,
            order: "create_time DESC"
        }, function(err, guoduUser) {
            if (err) {
                return logCb(err);
            }
            if (!guoduUser) {
                err = new Error(g.f('GuoduUser not found'));
                err.statusCode = 404;
                err.code = 'GUODU_NOT_FOUND';
                return logCb(err);
            }
            loginLog.uid = guoduUser.uid;
            var where2 = {
                uid: guoduUser.uid,
            };
            //查找该uid是否为guest
            var guodu_guest = false;
            GuoduUser.app.models.UserInfo.findOne({
                where: where2
            }, function(err, userInfo) {
                if (err) {
                    console.log("errr:", err);
                    return logCb(err);
                } else {
                    guodu_guest = userInfo.isGuest;
                }
            });
            UserModel.findOne({
                where: where2
            }, function(err, user) {
                if (err) {
                    return logCb(err);
                }
                if (!user) {
                    return logCb(Errs.no_user);
                }

                //非游客则进入判断
                if (!guodu_guest) {
                    if (!options.accountId || !options.token || !options.session || !options.sign) {
                        return logCb(Errs.empty_credentials);
                    }
                    if (process.env.env !== 'test') {
                        const _sign = util.md5(options.accountId + options.token + appKey);
                        if (options.sign.toLowerCase() != _sign.toLowerCase()) {
                            return logCb(Errs.wrong_credentials);
                        }
                    }
                }
                //更新数据库里面的token
                if (guoduUser.token !== options.token) {
                    guoduUser.token = options.token;
                    guoduUser.save((err3, data3) => {
                        if (err3) {
                            logger.loge.info(err3.stack);
                        }
                        console.log('save guodu token:', data3);
                    });
                }

                // // create a short lived access token for temp login to change password
                // // TODO(ritch) - eventually this should only allow password change
                // if (UserModel.settings.emailVerificationRequired && !user.emailVerified) {
                //     err = new Error(g.f('Email has not been verified'));
                //     err.statusCode = 401;
                //     err.code = 'RESET_FAILED_EMAIL_NOT_VERIFIED';
                //     return cb(err);
                // }

                user.createAccessToken(ttl, function(err, accessToken) {
                    if (err) {
                        return logCb(err);
                    }
                    // GuoduUser.app.models.AccessToken.find({
                    //     where: {
                    //         userId: guoduUser.uid
                    //     },
                    //     order: "create_time DESC"
                    // }, function(err, user) {
                    //     if (user.length > 1) {
                    //         for (var i = 0; i < user.length; i++) {
                    //             // 将前面已登录的token全部过期
                    //             if (user[i].id !== accessToken.id) {
                    //                 var myDate = new Date();
                    //                 myDate.setTime(0);
                    //                 user[i].updateAttribute('created', myDate);
                    //                 // console.log("user:",user[i]);
                    //             }
                    //         }
                    //     }
                    // });
                    logCb(null, accessToken);
                });
            });
        });

        return cb.promise;
    };

    GuoduUser.remoteMethod(
        'grant', {
            description: 'grant access right.',
            accepts: [{
                arg: 'options',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            }],
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'post',
                path: '/grant'
            },
        }
    );

    GuoduUser.afterRemote('grant', function(context, userInstance, next) {
        console.log('> GuoduUser.afterRemote of grant triggered');
        const app = require('../../server/server');
        const domain = app.get('config_domain');
        const sessionCookie = 'access_token=' + userInstance.id + ";domain=" + domain.host + ";path=/;Max-Age=" + 60 * 60 + ";HttpOnly";

        // context.res.setHeader("Set-Cookie", [sessionCookie]);
        context.res.cookie('access_token', userInstance.id, {
                // domain: domain.host,
                path: '/',
                'Max-Age': 60 * 60,
                httpOnly: true,
                signed: true
            })
            //踢下线
        util.kick_mult_login(GuoduUser, userInstance.userId, userInstance.id);
        //同步资金
        util.sync_positions(userInstance.userId, context.res._headers['set-cookie'], URL_DEFAULT_ACCOUNT, URL_DEFAULT_PORTFOLIO);
        next();
    });

    GuoduUser.init = function(uid, cookie, cb) {
        cb = cb || utils.createPromiseCallback();

        GuoduUser.findOne({
            where: {
                uid: uid
            },
            order: "create_time DESC"
        }, function(err, user) {
            if (err) return cb(err);
            if (!user) {
                return cb(Errs.no_user);
            }

            util.initAccount(user, cookie, (err, data) => {
                cb(err, data);
            });
        });

        return cb.promise;
    };

    GuoduUser.remoteMethod(
        'init', {
            description: 'init all.',
            accepts: [{
                arg: 'uid',
                type: 'string',
                'http': {
                    source: 'path'
                }
            }, {
                arg: 'cookie',
                type: 'string',
                http: function(ctx) {
                    var cookie = ctx.req.headers.cookie;
                    return cookie;
                }
            }],
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'get',
                path: '/:uid/init'
            },
        }
    );


    GuoduUser.removed = function(_uid, cookie, cb) {
        console.log('disable uid', _uid);
        async.waterfall([
                function(callback) {
                    util.set_user_disable(GuoduUser, _uid, 'GuoduUser', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(GuoduUser.app.models.Sso, _uid, 'Sso', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(GuoduUser.app.models.UserInfo, _uid, 'UserInfo', (err, data) => {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, {
                                result: 'success'
                            });
                        }
                    });
                }
            ],
            // optional callback
            function(err, results) {
                cb(err, results);
            });
        return cb.promise;
    };

    GuoduUser.remoteMethod(
        'removed', {
            description: 'disable all.',
            accepts: [{
                arg: 'uid',
                type: 'string',
                'http': {
                    source: 'path'
                }
            }, {
                arg: 'cookie',
                type: 'string',
                http: function(ctx) {
                    var cookie = ctx.req.headers.cookie;
                    return cookie;
                }
            }],
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'post',
                path: '/:uid/removed'
            },
        }
    );

    //给admin分页查询的接口
    GuoduUser.pagelist = function(filter, page, start, limit, cb) {
        //过滤游客
        var where = {
            accountId: {
                neq: '0000000'
            },
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
        console.log('filter_map------', filter_map);
        GuoduUser.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            GuoduUser.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    GuoduUser.remoteMethod('pagelist', {
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

    // GuoduUser.beforeRemote('*.*', function(context, userInstance, next) {
    //     console.log('> GuoduUser.beforeRemote of patchAttributes triggered');
    //     GuoduUser.findOne({
    //         where: {
    //             uid: context.req.params.id
    //         },
    //         order: "create_time DESC"
    //     }, function(err, guoduUser) {
    //         if (err) {
    //             return next(err);
    //         } else {
    //             context.req.params.id = guoduUser.uid;
    //             context.ctorArgs.id = guoduUser.uid;

    //             next();
    //         }
    //     })
    // });
};