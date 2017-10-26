'use strict';

const path = require("path");
const app = require('../../server/server');
console.log('app1', app)
const domain = app.get('config_domain');
const product = app.get('config_product');
const serviceAccount = app.get('config_service_account');
const serviceQuestionnaire = app.get('config_service_questionnaire');

const debug = require('debug')('loopback:user');
const utils = require('loopback/lib/utils');
const loopback = require('loopback/lib/loopback');
const assert = require('assert');
const qs = require('querystring');
const util = require('../util');
const async = require('async');
const _ = require('lodash');
const common = require('../common');
const g = require('loopback/lib/globalize');


const URL_DEFAULT_ACCOUNT = common.serviceUrls.URL_DEFAULT_ACCOUNT;
const URL_DEFAULT_PREFERENCE = common.serviceUrls.URL_DEFAULT_PREFERENCE;
const URL_DEFAULT_PORTFOLIO = common.serviceUrls.URL_DEFAULT_PORTFOLIO;
const URL_DEFAULT_RISK_TYPE = common.serviceUrls.URL_DEFAULT_RISK_TYPE;;

console.log('URL_DEFAULT_ACCOUNT', URL_DEFAULT_ACCOUNT);
console.log('URL_DEFAULT_PREFERENCE', URL_DEFAULT_PREFERENCE);
console.log('URL_DEFAULT_PORTFOLIO', URL_DEFAULT_PORTFOLIO);
console.log('URL_DEFAULT_RISK_TYPE', URL_DEFAULT_RISK_TYPE);

const ERR_MODEL_NOT_FOUND = common.errs.ERR_MODEL_NOT_FOUND;

module.exports = function(Planner) {
    //set filter
    Planner.beforeRemote('*', function(context, unused, next) {
        var _filter_list = ['find', 'findById', 'findOne'];
        var _where_list = ['count'];
        // console.log('context.method.name',context.method.name);
        if (_filter_list.indexOf(context.method.name) !== -1) {
            console.log('filter before modify:', context.args);
            context.args.filter = context.args.filter || {};
            if (context.args.filter.where && Object.keys(context.args.filter.where).length > 0) {
                context.args.filter.where = {
                    and: [context.args.filter.where, {
                        "disable": false
                    }]
                };
            } else {
                context.args.filter.where = {
                    "disable": false
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
                    "disable": false
                };
            }
            console.log('where after modify:', context.args.where);
            return next();
        }
        return next();
    });
    // Planner.beforeRemote('create', function(context, unused, next) {
    //     console.log(`req body`, context.req.body);
    //     var EmailUser = Planner.app.models.EmailUser;

    //     var _product = context.req.body['product'];
    //     if (_product) {
    //         if (!product.accept[_product]) {
    //             next('Unsupported product');
    //         }
    //     } else {
    //         _product = product.code;
    //     }

    //     let user_type = UserType.Planner;
    //     // if (context.req.body['type']) {
    //     //     user_type = context.req.body['type'];
    //     // }
    //     // util.generateUid(user_type, (err, uid) => {
    //     const salt = util.generateSalt();
    //     const pwd = util.hashPassword(context.req.body['password'], salt);
    //     EmailUser.create({
    //         type: user_type,
    //         oid: context.req.body['oid'],
    //         pid: 0,
    //         email: context.req.body['email'],
    //         // salt: Buffer.from(salt, 'hex').toString('hex'),
    //         password: context.req.body['password'], //Buffer.from(pwd, 'hex').toString('hex'),
    //         product: _product,
    //         activated: true
    //     }, function(err, sso) {
    //         if (err) return next(err);
    //         console.log(sso);
    //         context.req.body['uid'] = sso.uid;
    //         // context.req.body['pid'] = uid;
    //         next();
    //     });
    //     // })
    // });

    Planner.beforeRemote('prototype.__create__huaruns', function(context, unused, next) {
        console.log(`req body`, context.req.body);
        var sso = Planner.app.models.Sso;

        var _product = context.req.body['product'];
        if (_product) {
            if (!product.accept[_product]) {
                next('Unsupported product');
                return;
            }
        } else {
            _product = product.code;
        }

        let user_type = common.UserType.Normal;
        async.waterfall([
            function(callback) {
                console.log('1------');
                Planner.findOne({
                    where: {
                        pid: context.req.params.id
                    }
                }, function(err, _planner) {
                    callback(err, _planner);
                })
            },
            function(_planner, callback) {
                console.log('2------');
                util.generateUid(user_type, (err, uid) => {
                    callback(err, _planner, uid);
                })
            },
            function(_planner, uid, callback) {
                console.log('3------');
                const salt = util.generateSalt();
                const pwd = util.hashPassword('welcome-test!@', salt);
                sso.create({
                    uid: uid,
                    type: user_type,
                    oid: _planner.oid,
                    pid: _planner.pid,
                    name: context.req.body['xing'] + Date.parse(new Date()),
                    salt: Buffer.from(salt, 'hex').toString('hex'),
                    password: Buffer.from(pwd, 'hex').toString('hex'),
                    product: _product,
                    activated: false
                }, function(err, huarun) {
                    callback(err, _planner, uid);
                });
            },
            function(_planner, uid, callback) {
                console.log('4------');
                context.req.body['uid'] = uid;
                context.req.body['pid'] = _planner.pid;
                context.req.body['oid'] = _planner.oid;
                callback(null);
            }
        ], function(err, result) {
            console.log('5------');
            next(err);
        });
    });

    Planner.allHuaruns = function(pid, cookie, cb) {
        console.log('pid', pid);
        const SSO = Planner.app.models.Sso;
        Planner.app.models.HuarunUser.find({
            where: {
                pid: pid
            }
        }, function(err, users) {
            const _fn = function(item, cb) {
                // results is now an array of stats for each file
                SSO.findOne({
                    where: {
                        uid: item.uid,
                        activated: true
                    }
                }, function(err, _user) {
                    if (err || !_user) {
                        console.log(err);
                        _.remove(users, function(deletedItem) {
                            return deletedItem.uid == item.uid;
                        });
                        cb(null, {});
                        return;
                    } else {
                        async.waterfall([
                                function(callback) {
                                    const option = {
                                        url: URL_DEFAULT_ACCOUNT.replace(':uid', _user.uid),
                                        headers: {
                                            "content-type": 'application/json',
                                            "cookie": cookie
                                        },
                                        method: 'get'
                                    };
                                    util.proxy(option, (proxyErr, proxyData) => {
                                        if (proxyErr) {
                                            console.log(proxyErr);
                                            _.remove(users, function(deletedItem) {
                                                return deletedItem.uid == item.uid;
                                            });
                                        } else {
                                            _.merge(item, proxyData);
                                        };
                                        callback(proxyErr, proxyData);
                                    })
                                },
                                function(_account, callback) {
                                    if (!_account) {
                                        callback(null, _account);
                                        return;
                                    }
                                    const option = {
                                        url: URL_DEFAULT_PREFERENCE.replace(':uid', item.uid).replace(':accid', _account.id),
                                        headers: {
                                            "content-type": 'application/json',
                                            "cookie": cookie
                                        },
                                        method: 'get'
                                    };
                                    util.proxy(option, (proxyErr, proxyData) => {
                                        if (proxyErr) {
                                            console.log(proxyErr);
                                            _.remove(users, function(deletedItem) {
                                                return deletedItem.uid == item.uid;
                                            });
                                        } else {
                                            _.merge(item, proxyData);
                                        }
                                        callback(proxyErr, _account);
                                    })
                                },
                                function(_account, callback) {
                                    if (!_account) {
                                        callback(null, _account);
                                        return;
                                    }
                                    const option = {
                                        url: URL_DEFAULT_PORTFOLIO.replace(':uid', item.uid).replace(':accid', _account.id),
                                        headers: {
                                            "content-type": 'application/json',
                                            "cookie": cookie
                                        },
                                        method: 'get'
                                    };
                                    util.proxy(option, (proxyErr, proxyData) => {
                                        if (proxyErr) {
                                            console.log(proxyErr);
                                            _.remove(users, function(deletedItem) {
                                                return deletedItem.uid == item.uid;
                                            });
                                        } else {
                                            item['portfolio'] = proxyData;
                                            try {
                                                let allValue = 0;
                                                for (let i = 0; i < proxyData.length; i++) {
                                                    allValue = allValue + parseInt(proxyData[i].value);
                                                }

                                                item['earning'] = allValue - parseInt(item.invested_amount) + '';
                                                item['earningRatio'] = (allValue - parseInt(item.invested_amount)) / parseInt(item.invested_amount) + '';
                                            } catch (err) {
                                                console.log(err);
                                            }
                                        }
                                        callback(proxyErr, proxyData);
                                    })
                                },
                                function(_account, callback) {
                                    const option = {
                                        url: URL_DEFAULT_RISK_TYPE.replace(':uid', item.uid) + '?algo_product_id=' + result['algo_product_id'],
                                        headers: {
                                            "content-type": 'application/json',
                                            "cookie": cookie
                                        },
                                        method: 'get'
                                    };
                                    util.proxy(option, (proxyErr, proxyData) => {
                                        if (proxyErr) {
                                            console.log(proxyErr);
                                            // _.remove(users, function(deletedItem) {
                                            //     return deletedItem.uid == item.uid;
                                            // });
                                        } else {
                                            // _.merge(item, proxyData);
                                            if (proxyData) {
                                                item.risk_type = proxyData.risk_type;
                                            }
                                        }
                                        callback(proxyErr, proxyData);
                                    })
                                }
                            ],
                            // optional callback
                            function(err, results) {
                                // the results array will equal ['one','two'] even though
                                // the second function had a shorter timeout.
                                cb(err, results);
                            });
                    }
                })
            }

            async.each(users, _fn, function(err) {
                // results is now an array of stats for each file
                console.log(err);
                console.log('final1');
                cb(null, users);
            });
        });

    };

    Planner.remoteMethod('allHuaruns', {
        accepts: [{
            arg: 'pid',
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
            type: 'array'
        },
        http: {
            path: '/:pid/allhuaruns',
            verb: 'get'
        }
    });
    Planner.huarun = function(pid, uid, cookie, cb) {
        console.log('pid', pid);
        console.log('uid', uid);
        const SSO = Planner.app.models.Sso;
        SSO.findOne({
            where: {
                uid: uid,
                pid: pid,
                activated: true
            }
        }, function(err, _user) {
            let result = _user;
            if (err || !result) {
                cb(ERR_MODEL_NOT_FOUND);
                return;
            } else {
                async.waterfall([
                        function(callback) {
                            Planner.app.models.HuarunUser.findOne({
                                where: {
                                    pid: pid,
                                    uid: uid
                                }
                            }, function(err, huarunUser) {
                                if (err) {
                                    console.log(proxyErr);
                                    // _.remove(users, function(deletedItem) {
                                    //     return deletedItem.uid == item.uid;
                                    // });
                                } else {
                                    _.merge(result, huarunUser);
                                };
                                //console.log('huarun', result);
                                callback(null);
                            })
                        },
                        function(callback) {
                            const option = {
                                url: URL_DEFAULT_ACCOUNT.replace(':uid', uid),
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                    // _.remove(users, function(deletedItem) {
                                    //     return deletedItem.uid == item.uid;
                                    // });
                                } else {
                                    _.merge(result, proxyData);
                                };
                                //console.log('account', result);
                                callback(proxyErr, proxyData);
                            })
                        },
                        function(_account, callback) {
                            if (!_account) {
                                callback(null, _account);
                                return;
                            }
                            const option = {
                                url: URL_DEFAULT_PREFERENCE.replace(':uid', uid).replace(':accid', _account.id),
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                    // _.remove(users, function(deletedItem) {
                                    //     return deletedItem.uid == item.uid;
                                    // });
                                } else {
                                    _.merge(result, proxyData);
                                }
                                //console.log('preference', result);
                                callback(proxyErr, _account);
                            })
                        },
                        function(_account, callback) {
                            if (!_account) {
                                callback(null, _account);
                                return;
                            }
                            const option = {
                                url: URL_DEFAULT_PORTFOLIO.replace(':uid', uid).replace(':accid', _account.id),
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                    // _.remove(users, function(deletedItem) {
                                    //     return deletedItem.uid == item.uid;
                                    // });
                                } else {
                                    result['portfolio'] = proxyData;
                                    try {
                                        // let allValue = 0;
                                        // for (let i = 0; i < proxyData.length; i++) {
                                        //     allValue = allValue + parseInt(proxyData[i].value);
                                        // }
                                        result['earning'] = parseFloat(result.total_value) - parseFloat(result.invested_amount) + '';
                                        result['earningRatio'] = (parseFloat(result.total_value) - parseFloat(result.invested_amount)) / parseInt(result.invested_amount) + '';
                                    } catch (err) {
                                        console.log(err);
                                    }
                                }
                                console.log('portfolio', result);
                                callback(proxyErr, proxyData);
                            })
                        },
                        function(_account, callback) {
                            const option = {
                                url: URL_DEFAULT_RISK_TYPE.replace(':uid', uid) + '?algo_product_id=' + result['algo_product_id'],
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                    // _.remove(users, function(deletedItem) {
                                    //     return deletedItem.uid == item.uid;
                                    // });
                                } else {
                                    // _.merge(item, proxyData);
                                    if (proxyData) {
                                        result['risk_type'] = proxyData.risk_type;
                                    }
                                }
                                //console.log('risk_type', result);
                                callback(proxyErr, proxyData);
                            })
                        }
                    ],
                    // optional callback
                    function(err, results) {
                        // the results array will equal ['one','two'] even though
                        // the second function had a shorter timeout.
                        cb(null, result);
                    });
            }
        })
    };

    Planner.remoteMethod('huarun', {
        accepts: [{
            arg: 'pid',
            type: 'string',
            'http': {
                source: 'path'
            }
        }, {
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
            path: '/:pid/huaruns/:uid/account',
            verb: 'get'
        }
    });

    Planner.accountStatistics = function(pid, cookie, cb) {
        console.log('pid', pid);
        const SSO = Planner.app.models.Sso;
        SSO.find({
            where: {
                pid: pid,
                activated: true
            }
        }, function(err, users) {
            const _fn = function(item, cb) {
                // results is now an array of stats for each file
                async.waterfall([
                        function(callback) {
                            const option = {
                                url: URL_DEFAULT_ACCOUNT.replace(':uid', item.uid),
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                } else {
                                    _.merge(item, proxyData);
                                };
                                callback(proxyErr, proxyData);
                            })
                        },
                        function(_account, callback) {
                            if (!_account) {
                                callback(null, _account);
                                return;
                            }
                            const option = {
                                url: URL_DEFAULT_PORTFOLIO.replace(':uid', item.uid).replace(':accid', _account.id),
                                headers: {
                                    "content-type": 'application/json',
                                    "cookie": cookie
                                },
                                method: 'get'
                            };
                            util.proxy(option, (proxyErr, proxyData) => {
                                if (proxyErr) {
                                    console.log(proxyErr);
                                } else {
                                    item['portfolio'] = proxyData;
                                    try {
                                        // let allValue = 0;
                                        // for (let i = 0; i < proxyData.length; i++) {
                                        //     if (!isNaN(proxyData[i].value)) {
                                        //         allValue = allValue + parseFloat(proxyData[i].value);
                                        //     }
                                        // }
                                        _.merge(item, proxyData);
                                        // item['earning'] = parseFloat(proxyData.total_value) - parseFloat(item.invested_amount) + '';
                                        // // item['allEarning'] = allValue;
                                        // item['earningRatio'] = (item['earning']) / parseInt(item.invested_amount) + '';
                                    } catch (err) {
                                        console.log(err);
                                    }
                                }
                                callback(proxyErr, proxyData);
                            })
                        }
                    ],
                    // optional callback
                    function(err, results) {
                        // the results array will equal ['one','two'] even though
                        // the second function had a shorter timeout.
                        cb(err, results);
                    });
            }

            async.each(users, _fn, function(err) {
                // results is now an array of stats for each file
                console.log(err);
                console.log('final1');
                let allValue = 0;
                for (let i = 0; i < users.length; i++) {
                    if (!isNaN(parseFloat(users[i].total_value))) {
                        allValue = allValue + parseFloat(users[i].total_value);
                    }
                }
                cb(null, {
                    userCount: users.length,
                    allValue: allValue
                });
            });
        });
    };

    Planner.remoteMethod('accountStatistics', {
        accepts: [{
            arg: 'pid',
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
            path: '/:pid/account_statistics',
            verb: 'get'
        }
    });

    Planner.removed = function(_uid, cookie, cb) {
        console.log('disable uid', _uid);
        async.waterfall([
                function(callback) {
                    util.set_user_disable(Planner, _uid, 'Planner', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Planner.app.models.EmailUser, _uid, 'EmailUser', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Planner.app.models.Sso, _uid, 'Sso', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Planner.app.models.UserInfo, _uid, 'UserInfo', (err, data) => {
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

    Planner.remoteMethod(
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
    Planner.pagelist = function(filter, page, start, limit, cb) {
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
        console.log("filter_map----",filter_map);
        Planner.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            Planner.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    Planner.remoteMethod('pagelist', {
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
};