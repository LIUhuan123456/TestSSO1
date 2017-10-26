'use strict';
const util = require('../util');
const Errs = require('../errors');
const async = require('async');
module.exports = function(Huarunuser) {
    //set filter
    Huarunuser.beforeRemote('*', function(context, unused, next) {
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

    Huarunuser.removed = function(_uid, cookie, cb) {
        console.log('disable uid', _uid);
        async.waterfall([
                function(callback) {
                    util.set_user_disable(Huarunuser, _uid, 'Huarunuser', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Huarunuser.app.models.Sso, _uid, 'Sso', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Huarunuser.app.models.UserInfo, _uid, 'UserInfo', (err, data) => {
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

    Huarunuser.remoteMethod(
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
    Huarunuser.pagelist = function(filter, page, start, limit, cb) {
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
        Huarunuser.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            Huarunuser.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    Huarunuser.remoteMethod('pagelist', {
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
    // Huarunuser.init = function(uid, cb) {
    //     cb = cb || utils.createPromiseCallback();

    //     Huarunuser.findOne({
    //         where: {
    //             uid: uid
    //         },
    //         order: "create_time DESC"
    //     }, function(err, user) {
    //         if (err) return cb(err);
    //         if (!user) {
    //             const err = new Error('Could not find the model');
    //             err.statusCode = 404;
    //             err.code = 'USER_NOT_FOUND';
    //             return cb(err);
    //         }

    //         util.initAccount(user, (err, data) => {
    //             cb(err, data);
    //         });
    //     });

    //     return cb.promise;
    // };

    // Huarunuser.remoteMethod(
    //     'init', {
    //         description: 'init all.',
    //         accepts: {
    //             arg: 'uid',
    //             type: 'string',
    //             'http': {
    //                 source: 'path'
    //             }
    //         },
    //         returns: {
    //             root: true,
    //             type: 'Object'
    //         },
    //         http: {
    //             verb: 'get',
    //             path: '/:uid/init'
    //         },
    //     }
    // );
};