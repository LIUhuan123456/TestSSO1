const util = require('../../common/util');
const common = require('../../common/common');
const Errs = require('../../common/errors');
const g = require('loopback/lib/globalize');
const loopback = require('loopback');
var Redis = require('ioredis');
const async = require('async');
var redis = new Redis({
    sentinels: [{
        host: 'test.aqumon.com',
        port: 26379
    }],
    // host: 'test.aqumon.com', port: 26379,
    password: '#redis#@aqumon',
    name: 'redis-master'
});
const ERR_TRANSACTION_TIMEOUT = {
    "statusCode": 500,
    "name": "Error",
    "message": "Transaction Timeout",
    "status": 500,
    "code": "TRANSACTION_TIMEOUT"
}
const CONST_TIMEOUT = 6000;
const SMS_CODE_EXPIRE = 5*60;//5 min
const EMAIL_CODE_EXPIRE = 30*60;//30 min
const redis_invitecode_list = process.env.env+'_invite_code';
module.exports = function(app) {
    app.set('trust proxy', true);
    // app.models.AdminUser.find({}, (err, admins) => {
    //     for (var i = 0; i < admins.length; i++) {
    //         admin = admins[i];
    //         app.models.Sso.findOne({
    //             where: {
    //                 uid: admin.uid,
    //                 activated: true,
    //                 loginable: true,
    //                 locked: false
    //             },
    //             order: "create_time DESC"
    //         }, (err, user) => {

    //         })
    //     }
    // })
    loopback.configureModel(app.models.AccessToken, {
        "dataSource": app.models.AccessToken.dataSource,
        "acls": [{
            "principalType": "ROLE",
            "principalId": "$everyone",
            "permission": "DENY"
        }, {
            "principalType": "ROLE",
            "principalId": "$everyone",
            "property": "create",
            "permission": "ALLOW"
        }, {
            "accessType": "*",
            "principalType": "ROLE",
            "principalId": "admin",
            "permission": "ALLOW",
            "property": "*"
        }]
    });
    console.log('USER', app.models.RoleMapping.USER);
    const EmailUser = app.models.EmailUser;
    const Sso = app.models.Sso;
    const AdminUser = app.models.AdminUser;
    const Planner = app.models.Planner;
    const GuoduUser = app.models.GuoduUser;
    const UserInfo = app.models.UserInfo;
    const PhoneUser = app.models.PhoneUser;
    const InvitedUser = app.models.InvitedUser;
    const product = app.get('config_product');
    // const UserType = {
    //     Investor: 100,
    //     Planner: 200,
    //     Guodu: 300,
    //     Admin: 40
    // };
    const emailUserCreate = EmailUser.create;
    const plannerCreate = Planner.create;
    const guoduUserCreate = GuoduUser.create;
    const ssoCreate = Sso.create;
    const adminUserCreate = AdminUser.create;
    const phoneUserCreate = PhoneUser.create;
    const invitedUserCreate = InvitedUser.create;

    PhoneUser.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        context.req.body['product'] = _product;
        context.req.body['type'] = common.UserType.Normal;
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }
        //康宏创建用户时默认密码
        if (context.req.body['cis_defualt'] === true) {
            context.req.body['password'] = 'CIS12345';
        }
        async.waterfall([
            function(callback){//字段完整性检查
                console.log('1---');
                if(!context.req.body['num']) {
                    return callback(Errs.no_mobile);
                }
                if(!context.req.body['password']) {
                    return callback(Errs.password_format);
                }
                return callback();
            },
            // function(callback){//唯一性检查
            //     console.log('2---');
            //     var where = {area:context.req.body['area'], num: context.req.body['num']};
            //     isUserExist(PhoneUser,where).then((result)=>{
            //         return callback(Errs.phone_not_unique);
            //     },(err)=>{
            //         if(err) {return callback(err)} 
            //         else { return callback();}
            //     }).catch((err)=>{
            //         return callback(err);
            //     });
            // },
            function(callback) {//字段校验
                console.log('3---');
                util.passwordVerify(context.req.body['password']).then(()=>{
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback){//检查验证码
                console.log('4----');
                var mobile_full = context.req.body['area']+context.req.body['num'];
                util.redisFindCode(mobile_full).then(function(result){
                    var Rvalue = JSON.parse(result);
                    console.log('Rvalue code---', Rvalue.code);
                    if (Rvalue.code !== context.req.body['smscode']) {
                        Rvalue.times += 1;
                        if (Rvalue.times >= 10) { //试错10次
                            redis.del(mobile_full);
                        } else {
                            var timenow = new Date();
                            var timenow_sec = Math.floor(timenow.getTime() / 1000);
                            var newEx = (SMS_CODE_EXPIRE - (timenow_sec - Rvalue.time));//更新剩余时间
                            if (newEx <= 0) {
                                newEx = 0;
                            }
                            redis.set(mobile_full, JSON.stringify(Rvalue), 'ex', newEx);
                        }
                        return callback(Errs.smscode_wrong);
                    } else {
                        return callback();
                    }
                },function(err){
                    if(err) {
                        return callback(err);
                    } else {
                        return callback(Errs.smscode_wrong);
                    }
                }).catch((err)=>{
                    return callback(err);
                })
            },
            function(callback) {//生成UID
                console.log('5---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('6---');
                if(err) {return next(err);} else { return next();}
            });
    });

    PhoneUser.create = function(data, token, done) {
        // Do custom things
        if (!done) {
            done = token;
        }
        const salt = util.generateSalt();
        const pwd = util.hashPassword(data.password, salt);
        var ssoData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: data.pid,
            xing: data.xing,
            name: data.name,
            // name: context.instance.name,
            salt: Buffer.from(salt, 'hex').toString('hex'),
            password: Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true
        };
        createTransaction(Sso,PhoneUser,phoneUserCreate,ssoData,data).then(function(result) {
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    EmailUser.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        context.req.body['product'] = _product;
        context.req.body['type'] = common.UserType.Normal;
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }
        //康宏创建用户时默认密码
        if (context.req.body['cis_defualt'] === true) {
            context.req.body['password'] = 'CIS12345';
        }
        async.waterfall([
            function(callback){//字段完整性检查
                console.log('1---');
                if(!context.req.body['email']) {
                    return callback(Errs.no_email);
                }
                if(!util.emailFormatVerify(context.req.body['email'])) {
                    return callback(Errs.email_format);
                }
                if(!context.req.body['password']) {
                    return callback(Errs.password_format);
                }
                return callback();
            },
            function(callback){//唯一性检查
                console.log('2---');
                var where = {email: context.req.body['email']};
                isUserExist(EmailUser,where).then((result)=>{
                    return callback(Errs.email_not_unique);
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback) {//字段校验
                console.log('3---');
                util.passwordVerify(context.req.body['password']).then(()=>{
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback){//检查验证码
                console.log('4----');
                if(context.req.body['verify_type'] === 'code') {
                    util.redisFindCode(context.req.body['email']).then(function(result){
                        var Rvalue = JSON.parse(result);
                        console.log('Rvalue code---', Rvalue.code);
                        if (Rvalue.code !== context.req.body['emailcode']) {
                            Rvalue.times += 1;
                            if (Rvalue.times >= 10) { //试错10次
                                redis.del(context.req.body['email']);
                            } else {
                                var timenow = new Date();
                                var timenow_sec = Math.floor(timenow.getTime() / 1000);
                                var newEx = (EMAIL_CODE_EXPIRE - (timenow_sec - Rvalue.time));//更新剩余时间
                                if (newEx <= 0) {
                                    newEx = 0;
                                }
                                redis.set(context.req.body['email'], JSON.stringify(Rvalue), 'ex', newEx);
                            }
                            return callback(Errs.emailcode_wrong);
                        } else {
                            return callback();
                        }
                    },function(err){
                        if(err) {
                            return callback(err);
                        } else {
                            return callback(Errs.emailcode_wrong);
                        }
                    }).catch((err)=>{
                        return callback(err);
                    })
                } else {
                    return callback();
                }
            },
            function(callback) {//生成UID
                console.log('5---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('6---');
                if(err) {return next(err);} else { return next();}
            });
    });

    // Overrides POST '/api/MyModel' endpoint
    EmailUser.create = function(data, token, done) {
        // Do custom things
        if (!done) {
            done = token;
        }
        const salt = util.generateSalt();
        const pwd = util.hashPassword(data.password, salt);
        var ssoData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: data.pid,
            xing: data.xing,
            name: data.name,
            // name: context.instance.name,
            salt: Buffer.from(salt, 'hex').toString('hex'),
            password: Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true
        };
        createTransaction(Sso,EmailUser,emailUserCreate,ssoData,data).then((result)=>{
            return done(null,result);
        },(err)=>{
            return done(err);
        }).catch((err)=>{
            console.log('catch err---',err);
            return done(err);
        });
    };

    InvitedUser.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        context.req.body['product'] = _product;
        context.req.body['password'] = 'invited@2017';
        context.req.body['type'] = common.UserType.Normal;
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }
        async.waterfall([
            function(callback){//字段完整性检查
                console.log('字段完整性检查---');
                if(!context.req.body['email']) {
                    return callback(Errs.lack_field);
                }
                if(!util.emailFormatVerify(context.req.body['email'])) {
                    return callback(Errs.email_format);
                }
                if(!context.req.body['invite_code']) {
                    return callback(Errs.lack_field);
                }
                if(!context.req.body['mobile_area']) {
                    return callback(Errs.lack_field);
                }
                if(!context.req.body['mobile_num']) {
                    return callback(Errs.lack_field);
                }
                if(!context.req.body['smscode']) {
                    return callback(Errs.lack_field);
                }
                return callback();
            },
            function(callback){//检查验证码
                console.log('检查验证码----');
                var mobile_full = context.req.body['mobile_area']+context.req.body['mobile_num'];
                util.redisFindCode(mobile_full).then(function(result){
                    var Rvalue = JSON.parse(result);
                    console.log('Rvalue code---', Rvalue.code);
                    if (Rvalue.code !== context.req.body['smscode']) {
                        Rvalue.times += 1;
                        if (Rvalue.times >= 10) { //试错10次
                            redis.del(mobile_full);
                        } else {
                            var timenow = new Date();
                            var timenow_sec = Math.floor(timenow.getTime() / 1000);
                            var newEx = (SMS_CODE_EXPIRE - (timenow_sec - Rvalue.time));//更新剩余时间
                            if (newEx <= 0) {
                                newEx = 0;
                            }
                            redis.set(mobile_full, JSON.stringify(Rvalue), 'ex', newEx);
                        }
                        return callback(Errs.smscode_wrong);
                    } else {
                        return callback();
                    }
                },function(err){
                    if(err) {
                        return callback(err);
                    } else {
                        return callback(Errs.smscode_wrong);
                    }
                }).catch((err)=>{
                    return callback(err);
                })
            },
            // function(callback){//唯一性检查
            //     console.log('唯一性检查---');
            //     var where = {area:context.req.body['mobile_area'], num: context.req.body['mobile_num']};
            //     isUserExist(PhoneUser,where).then((result)=>{
            //         return callback(Errs.phone_not_unique);
            //     },(err)=>{
            //         if(err) {return callback(err)} 
            //         else { return callback();}
            //     }).catch((err)=>{
            //         return callback(err);
            //     });
            // },
            function(callback){//检查邀请码
                console.log('检查邀请码----');
                InvitedUser.findOne({where:{invite_code:context.req.body['invite_code']}},(err,user)=>{
                    if(err) {
                        return callback(err);
                    }
                    if(!user) {
                        redis.lindex(redis_invitecode_list,-1,function(err,result){
                            if(err) {
                                return callback(Errs.server_error);
                            }
                            if(context.req.body['invite_code'] <= result) {
                                return callback();
                            }
                            return callback(Errs.wrong_invite_code);
                        });
                    } else {
                        return callback(Errs.wrong_invite_code);
                    }
                });
            },
            function(callback) {//生成UID
                console.log('生成UID---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('返回---');
                if(err) {return next(err);} else { return next();}
            });
    });
    // Overrides POST '/api/MyModel' endpoint
    InvitedUser.create = function(data, token, done) {
        if (!done) {
            done = token;
        };
        var phoneData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: 0,
            email: data.email,
            area: data.mobile_area,
            num: data.mobile_num,
            // salt: Buffer.from(salt, 'hex').toString('hex'),
            password: data.password, //Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true
        };
        createTransaction(PhoneUser,InvitedUser,invitedUserCreate,phoneData,data).then(function(result){
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    Planner.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        context.req.body['product'] = _product;
        context.req.body['type'] = common.UserType.Planner;
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }
        async.waterfall([
            function(callback){//字段完整性检查
                console.log('1---');
                if(!context.req.body['email']) {
                    return callback(Errs.no_email);
                }
                if(!util.emailFormatVerify(context.req.body['email'])) {
                    return callback(Errs.email_format);
                }
                if(!context.req.body['password']) {
                    return callback(Errs.password_format);
                }
                if(context.req.body['pid']) {
                    return callback(Errs.illegal_field);
                }
                return callback();
            },
            function(callback){//唯一性检查
                console.log('2---');
                var where = {email: context.req.body['email']};
                isUserExist(EmailUser,where).then((result)=>{
                    return callback(Errs.email_not_unique);
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback) {//字段校验
                console.log('3---');
                util.passwordVerify(context.req.body['password']).then(()=>{
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback) {//生成UID
                console.log('5---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('6---');
                if(err) {return next(err);} else { return next();}
            });
    });
    // Overrides POST '/api/MyModel' endpoint
    Planner.create = function(data, token, done) {
        if (!done) {
            done = token;
        };
        var ssoData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: 0,
            email: data.email,
            // salt: Buffer.from(salt, 'hex').toString('hex'),
            password: data.password, //Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true
        };
        createTransaction(EmailUser,Planner,plannerCreate,ssoData,data).then(function(result){
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    GuoduUser.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        console.log('body', context.req.body);
        context.req.body['product'] = _product;
        context.req.body['type'] = common.UserType.Normal;
        context.req.body['password'] = 'guodu@123';
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }

        async.waterfall([
            function(callback) {//生成UID
                console.log('5---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('6---');
                if(err) {return next(err);} else { return next();}
            });
    });
    // Overrides POST '/api/MyModel' endpoint
    GuoduUser.create = function(data, token, done) {
        // Do custom things
        if (!done) {
            done = token;
        }
        data.oid = 3;
        const salt = util.generateSalt();
        const pwd = util.hashPassword(data.password, salt);
        var ssoData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: 0,
            // name: context.instance.name,
            salt: Buffer.from(salt, 'hex').toString('hex'),
            password: Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true,
            loginable: false,
            isGuest: data.isGuest
        };
        createTransaction(Sso,GuoduUser,guoduUserCreate,ssoData,data).then(function(result){
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    // Overrides POST '/api/MyModel' endpoint
    Sso.create = function(data, token, done) {
        // Do custom things
        if (!done) {
            done = token;
        }
        createTransaction(UserInfo,Sso,ssoCreate,data,data).then(function(result){
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    AdminUser.beforeRemote('create', function(context, unused, next) {
        var _product = context.req.headers.host;
        context.req.body['product'] = _product;
        context.req.body['type'] = common.UserType.Admin;
        if (context.req.body['tester'] === true) {
            context.req.body['type'] = common.UserType.Tester;
        }
        async.waterfall([
            function(callback){//字段完整性检查
                console.log('1---');
                if(!context.req.body['email']) {
                    return callback(Errs.no_email);
                }
                if(!util.emailFormatVerify(context.req.body['email'])) {
                    return callback(Errs.email_format);
                }
                if(!context.req.body['password']) {
                    return callback(Errs.password_format);
                }
                return callback();
            },
            function(callback){//唯一性检查
                console.log('2---');
                var where = {email: context.req.body['email']};
                isUserExist(AdminUser,where).then((result)=>{
                    return callback(Errs.email_not_unique);
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback) {//字段校验
                console.log('3---');
                util.passwordVerify(context.req.body['password']).then(()=>{
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            },
            function(callback) {//生成UID
                console.log('5---');
                createUID(context.req.body['type']).then((uid)=>{
                    context.req.body['uid'] = uid;
                    return callback();
                },(err)=>{
                    return callback(err);
                }).catch((err)=>{
                    return callback(err);
                });
            }
            ],function(err){
                console.log('6---');
                if(err) {return next(err);} else { return next();}
            });
    });
    // Overrides POST '/api/MyModel' endpoint
    AdminUser.create = function(data, token, done) {
        // Do custom things
        if (!done) {
            done = token;
        }
        const salt = util.generateSalt();
        const pwd = util.hashPassword(data.password, salt);
        var ssoData = {
            uid: data.uid,
            type: data.type,
            oid: data.oid,
            pid: data.pid,
            // name: context.instance.name,
            salt: Buffer.from(salt, 'hex').toString('hex'),
            password: Buffer.from(pwd, 'hex').toString('hex'),
            product: data.product,
            activated: true
        };
        createTransaction(Sso,AdminUser,adminUserCreate,ssoData,data).then(function(result){
            return done(null,result);
        },function(err){
            return done(err);
        }).catch(function(err){
            console.log('catch err---',err);
            return done(err);
        });
    };

    //不检查token的白名单
    ///v1/products/domain_product
    ///v1/guodu_users
    ///v1/orgs/1
    ///v1/orgs/3/default_algo_product
    ///v1/guodu_users/grant
    ///v1/sso/login
    ///v1/sso/checkUser
    ///v1/email_users
    ///v1/email_users/findone
    ///v1/guodu_users/findone
    app.models.AccessToken.findForRequest = function(req, options, cb) {
        if (cb === undefined && typeof options === 'function') {
            cb = options;
            options = {};
        }

        var id = this.getIdForRequest(req, options);

        var regexp1 = /\/v1\/products\/domain_product(?!\/)/i;
        var regexp2 = /\/v1\/orgs\/\d{1,}\/default_algo_product(?!\/)/i;
        var regexp3 = /\/v1\/guodu_users(?!\/)/i;
        var regexp4 = /\/v1\/guodu_users\/findone(?!\/)/i;
        var regexp5 = /\/v1\/guodu_users\/grant(?!\/)/i;
        var regexp6 = /\/v1\/sso\/login(?!\/)/i;
        var regexp7 = /\/v1\/sso\/checkUser(?!\/)/i;
        var regexp8 = /\/v1\/email_users(?!\/)/i;
        var regexp9 = /\/v1\/email_users\/findone(?!\/)/i;
        var regexp10 = /\/v1\/orgs\/\d{1,}(?!\/)/i;

        if (req.url.search(regexp1) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp2) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp3) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp4) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp5) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp6) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp7) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp8) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp9) !== -1) {
            console.log("no check token!");
            id = undefined;
        } else if (req.url.search(regexp10) !== -1) {
            console.log("no check token!");
            id = undefined;
        }

        if (id) {
            this.resolve(id, cb);
        } else {
            process.nextTick(cb);
        }
    };

    app.models.AccessToken.resolve = function(id, cb) {
        console.log("into the reload resolve**********");
        this.findById(id, function(err, token) {
            if (err) {
                cb(err);
            } else if (token) {
                console.log("token", token);
                token.validate(function(err, isValid) {
                    if (err) {
                        cb(err);
                    } else if (isValid) {
                        cb(null, token);
                    } else {
                        if (token.created.getTime() === 0) {
                            cb(Errs.login_other_place);
                        } else {
                            cb(Errs.invalid_token);
                        }


                    }
                });
            } else {
                cb();
            }
        });
    };
}

//检查用户是否存在
function isUserExist(model, where) {
    var p = new Promise(function(resolve, reject) {
        model.findOne({
            where: where
        }, function(err, user) {
            if (err) {
                reject(err);
            }
            if (user) {
                resolve(user);
            } else {
                reject();
            }
        });
    });
    return p;
}

//创建用户uid
function createUID(type) {
    var p = new Promise(function(resolve,reject){
        util.generateUid(type, (err, uid) => {
            if(err) {
                reject(err);
            }
            if(uid) {
                resolve(uid);
            } else {
                reject('Can not create uid.');
            }
        });
    });
    return p;
}

//创建用户的事务
function createTransaction(up_model, down_model, create_method, up_data, down_data) {
    var p = new Promise(function(resolve, reject) {
        down_model.beginTransaction({
            isolationLevel: down_model.Transaction.READ_COMMITTED,
            timeout: CONST_TIMEOUT
        }, function(err, tx) {
            // Now we have a transaction (tx)
            tx.observe('timeout', function(context, next) {
                // handle timeout
                console.log('Timeout!!!');
                next(ERR_TRANSACTION_TIMEOUT);
            });
            //开始创建用户
            up_model.create(up_data, {
                transaction: tx
            }, (err, new_model) => {
                if (err) {
                    tx.rollback(function(err) {
                        console.log('rollback', err);
                    });
                    reject(err);
                } else {
                    down_data.uid = new_model.uid;

                    create_method.call(down_model, down_data, {
                        transaction: tx
                    }, (err, data) => {
                        if (err) {
                            tx.rollback(function(err) {
                                console.log('rollback', err);
                            });
                            reject(err);
                        } else {
                            tx.commit(function(err) {
                                console.log('commit', err);
                                resolve(data);
                            })
                        }
                    });
                }
            });
        }); //endof beginTransaction
    });
    return p;
}

