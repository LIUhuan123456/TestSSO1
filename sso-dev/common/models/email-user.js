'use strict';

const path = require("path");
const ejs = require('ejs');
const fs = require('fs');
const TPL_PASSWORD_INFO = fs.readFileSync(path.join(__dirname, '../../server/views/password-info.tpl'), 'utf8');
const CIS_TPL_PASSWORD_INFO = fs.readFileSync(path.join(__dirname, '../../server/views/cis-password-info.tpl'), 'utf8');
const app = require('../../server/server');
const domain = app.get('config_domain');
const product = app.get('config_product');

const debug = require('debug')('loopback:user');
const utils = require('loopback/lib/utils');
const loopback = require('loopback/lib/loopback');
const assert = require('assert');
const qs = require('querystring');
const util = require('../util');
const Errs = require('../errors');
const async = require('async');
const crypto = require('crypto');
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
const DEFAULT_TTL = 1209600; // 2 weeks in seconds
const DEFAULT_RESET_PW_TTL = 15 * 60; // 15 mins in seconds
const DEFAULT_MAX_TTL = 31556926; // 1 year in seconds

const g = require('loopback/lib/globalize');

const UserType = {
    Investor: 100,
    Planner: 200
};

module.exports = function(Emailuser) {
    var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

    Emailuser.validatesFormatOf('email', {
        with: re,
        message: 'Must provide a valid email'
    });
    Emailuser.validatesUniquenessOf('email', {
        message: 'email is not unique'
    });
    // Emailuser.validate('password', passwordVerify, {
    //     message: Errs.password_format
    // });



    // Emailuser.observe('before save', function(context, next) {
    //     console.log(`req body`, context.instance);
    //     var sso = Emailuser.app.models.Sso;
    //     if (context.isNewInstance) {
    //         var _product = context.instance.product;
    //         if (_product) {
    //             if (!product.accept[_product]) {
    //                 next('Unsupported product');
    //             }
    //         } else {
    //             _product = product.code;
    //         }

    //         let user_type = UserType.Investor;
    //         // if (context.req.body['type']) {
    //         //     user_type = context.req.body['type'];
    //         // }
    //         util.generateUid(user_type, (err, uid) => {
    //             const salt = util.generateSalt();
    //             const pwd = util.hashPassword(context.instance.password, salt);
    //             sso.create({
    //                 uid: uid,
    //                 type: user_type,
    //                 oid: context.instance.oid,
    //                 pid: context.instance.pid,
    //                 // name: context.instance.name,
    //                 salt: Buffer.from(salt, 'hex').toString('hex'),
    //                 password: Buffer.from(pwd, 'hex').toString('hex'),
    //                 product: _product,
    //                 activated: true
    //             }, function(err, sso) {
    //                 if (err) return next(err);
    //                 console.log(sso);
    //                 context.instance.uid = sso.uid;
    //                 next();
    //             });
    //         })
    //     }
    // })
    Emailuser.beforeRemote('*', function(context, unused, next) {
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


    Emailuser.afterRemote('create', function(context, userInstance, next) {
        console.log('> user.afterRemote triggered');

        //todo
        next();
        return;
        const app = require('../../server/server');

        var options = {
            type: 'email',
            to: userInstance.email,
            from: 'info@mail.aqumon.com',
            subject: 'Thanks for registering.',
            template: path.resolve(__dirname, '../../server/views/verify.ejs'),
            redirect: '/verified',
            user: userInstance,
            protocol: domain.protocol,
            host: domain.host,
            port: domain.port
        };

        userInstance.verify(options, function(err, response) {
            if (err) return next(err);

            console.log('> verification email sent:', response);
            next();
        });
    });

    /**
     * Verify a user's identity by sending them a confirmation email.
     *
     * ```js
     *    var options = {
     *      type: 'email',
     *      to: user.email,
     *      template: 'verify.ejs',
     *      redirect: '/',
     *      tokenGenerator: function (user, cb) { cb("random-token"); }
     *    };
     *
     *    user.verify(options, next);
     * ```
     */

    Emailuser.prototype.verify = function(options, fn) {
        fn = fn || utils.createPromiseCallback();

        var user = this;
        var userModel = this.constructor;
        var registry = userModel.registry;
        var pkName = 'uid'; //userModel.definition.idName() || 'id';
        assert(typeof options === 'object', 'options required when calling user.verify()');
        assert(options.type, 'You must supply a verification type (options.type)');
        assert(options.type === 'email', 'Unsupported verification type');
        assert(options.to || this.email,
            'Must include options.to when calling user.verify() ' +
            'or the user must have an email property');
        assert(options.from, 'Must include options.from when calling user.verify()');

        options.redirect = options.redirect || '/';
        var defaultTemplate = path.join(__dirname, '..', '..', 'templates', 'verify.ejs');
        options.template = path.resolve(options.template || defaultTemplate);
        options.user = this;
        options.protocol = options.protocol || 'http';

        var app = userModel.app;
        options.host = options.host || (app && app.get('host')) || 'localhost';
        options.port = options.port || (app && app.get('port')) || 3000;
        options.restApiRoot = options.restApiRoot || (app && app.get('restApiRoot')) || '/api';

        var displayPort = (
            (options.protocol === 'http' && options.port == '80') ||
            (options.protocol === 'https' && options.port == '443')
        ) ? '' : ':' + options.port;

        var urlPath = joinUrlPath(
            options.restApiRoot,
            userModel.http.path,
            userModel.sharedClass.findMethodByName('confirm').http.path
        );

        options.verifyHref = options.verifyHref ||
            options.protocol +
            '://' +
            options.host +
            displayPort +
            urlPath +
            '?' + qs.stringify({
                uid: options.user[pkName],
                redirect: options.redirect,
            });

        options.templateFn = options.templateFn || createVerificationEmailBody;

        // Email model
        var Email =
            options.mailer || this.constructor.email || registry.getModelByType(loopback.Email);

        // Set a default token generation function if one is not provided
        var tokenGenerator = options.generateVerificationToken || Emailuser.generateVerificationToken;

        tokenGenerator(user, function(err, token) {
            if (err) {
                return fn(err);
            }

            user.verificationToken = token;
            user.save(function(err) {
                if (err) {
                    fn(err);
                } else {
                    sendEmail(user);
                }
            });
        });

        // TODO - support more verification types
        function sendEmail(user) {
            options.verifyHref += '&token=' + user.verificationToken;

            options.text = options.text || g.f('Please verify your email by opening ' +
                'this link in a web browser:\n\t%s', options.verifyHref);

            options.text = options.text.replace(/\{href\}/g, options.verifyHref);

            options.to = options.to || user.email;

            options.subject = options.subject || g.f('Thanks for Registering');

            options.headers = options.headers || {};

            options.templateFn(options, function(err, html) {
                if (err) {
                    fn(err);
                } else {
                    setHtmlContentAndSend(html);
                }
            });

            function setHtmlContentAndSend(html) {
                options.html = html;

                // Remove options.template to prevent rejection by certain
                // nodemailer transport plugins.
                delete options.template;

                Email.send(options, function(err, email) {
                    if (err) {
                        fn(err);
                    } else {
                        fn(null, {
                            email: email,
                            token: user.verificationToken,
                            uid: user[pkName]
                        });
                    }
                });
            }
        }
        return fn.promise;
    };

    /**
     * Confirm the user's identity.
     *
     * @param {Any} userId
     * @param {String} token The validation token
     * @param {String} redirect URL to redirect the user to once confirmed
     * @callback {Function} callback
     * @param {Error} err
     * @promise
     */
    Emailuser.confirm = function(uid, token, redirect, fn) {
        fn = fn || utils.createPromiseCallback();
        const self = this;
        this.findOne({
            where: {
                uid: uid
            }
        }, function(err, user) {
            if (err) {
                fn(err);
            } else {
                if (user && user.verificationToken === token) {
                    user.verificationToken = null;
                    user.emailVerified = true;
                    user.save(function(err) {
                        if (err) {
                            fn(err);
                        } else {
                            self.app.models.Sso.findById(user.uid, function(err, sso) {
                                if (err) {
                                    fn(err);
                                } else {
                                    sso.activated = true;
                                    sso.save(function(err) {
                                        if (err) {
                                            fn(err);
                                        } else {
                                            fn();
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    if (user) {
                        fn(Errs.invalid_token);
                    } else {
                        fn(Errs.no_user);
                    }
                }
            }
        });
        return fn.promise;
    };

    Emailuser.remoteMethod(
        'confirm', {
            description: 'Confirm a user registration with email verification token.',
            accepts: [{
                arg: 'uid',
                type: 'string',
                required: true
            }, {
                arg: 'token',
                type: 'string',
                required: true
            }, {
                arg: 'redirect',
                type: 'string'
            }, ],
            http: {
                verb: 'get',
                path: '/confirm'
            },
        }
    );

    /**
     * Create a short lived access token for temporary login. Allows users
     * to change passwords if forgotten.
     *
     */

    Emailuser.resetPassword = function(options, origin, cb) {
        cb = cb || utils.createPromiseCallback();
        var UserModel = Emailuser.app.models.Sso;
        // var UserModel = this;
        var ttl = UserModel.settings.resetPasswordTokenTTL || DEFAULT_RESET_PW_TTL;
        options = options || {};
        if (typeof options.email !== 'string') {
            cb(Errs.email_required);
            return cb.promise;
        }

        try {
            if (options.password) {
                UserModel.validatePassword(options.password);
            }
        } catch (err) {
            return cb(err);
        }
        var where = {
            email: options.email
        };
        if (options.realm) {
            where.realm = options.realm;
        }
        Emailuser.findOne({
            where: where,
            order: "create_time DESC"
        }, function(err, emailUser) {
            if (err) {
                return cb(err);
            }
            if (!emailUser) {
                return cb(Errs.no_email);
            }
            var where2 = {
                uid: emailUser.uid,
            };
            UserModel.findOne({
                where: where2
            }, function(err, user) {
                if (err) {
                    return cb(err);
                }
                if (!user) {
                    return cb(Errs.no_email);
                }
                // create a short lived access token for temp login to change password
                // TODO(ritch) - eventually this should only allow password change
                if (UserModel.settings.emailVerificationRequired && !user.emailVerified) {
                    return cb(Errs.email_not_verified);
                }
                ttl = 24 * 60 * 60; //24 hour
                user.createAccessToken(ttl, function(err, accessToken) {
                    if (err) {
                        return cb(err);
                    }
                    cb();
                    Emailuser.emit('resetPasswordRequest', {
                        email: options.email,
                        accessToken: accessToken,
                        user: user,
                        options: options,
                        origin: origin
                    });
                });
            });
        });

        return cb.promise;
    };

    Emailuser.remoteMethod(
        'resetPassword', {
            description: 'Reset password for a user with email.',
            accepts: [{
                arg: 'options',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            }, {
                arg: 'origin',
                type: 'string',
                http: function(ctx) {
                    if (ctx.req.headers.origin) {
                        return ctx.req.headers.origin;
                    } else {
                        const index = ctx.req.headers.referer.indexOf('//');
                        return ctx.req.headers.referer.substring(0, ctx.req.headers.referer.indexOf('/', index + 2));
                    }
                    return ctx.req.headers.origin;
                }
            }],
            http: {
                verb: 'post',
                path: '/reset_password'
            },
        }
    );

    Emailuser.on('resetPasswordRequest', function(info) {
        // console.log('infff', info);
        const app = require('../../server/server');
        const domain = app.get('config_domain');
        var url = `${info.origin}/v1/users/reset_password?access_token=${info.accessToken.id}`;
        var html = TPL_PASSWORD_INFO.replace('{{link}}', url).replace('{{link}}', url);
        var _subject = '重置密码链接';
        // if(info.origin.indexOf('cissecurities.aqumon.com') !== -1 || info.origin.indexOf('192.168.0.155') !== -1) {
        if (info.origin.indexOf('cissecurities.aqumon.com') !== -1 || info.origin.indexOf('convoy.aqumon.com') !== -1) {
            html = CIS_TPL_PASSWORD_INFO.replace('{{link}}', url).replace('{{link}}', url);
            _subject = '康宏证券投资账户重置密码链接';
        }
        //const redirect = domain.protocol + '://' + domain.host + '/' + app.get('config_login_address');
        Emailuser.app.models.Email.send({
            to: info.email,
            from: 'info@mail.aqumon.com',
            subject: _subject,
            html: html,
            // attachments: {
            //     path: './费用报销清单20170725.xlsx'
            // }
        }, function(err) {
            if (err) return console.log('> error sending password reset email', err);
            console.log('> sending password reset email to:', info.email);
        });
        // context.res.render('password-info', {
        //     link: redirect
        // });
    });


    Emailuser.afterRemote('confirm', function(context, userInstance, next) {
        console.log('> user.afterRemote triggered');
        const app = require('../../server/server');
        const domain = app.get('config_uidomain');
        const redirect = domain.protocol + '://' + domain.host + '/' + app.get('config_login_address');
        console.log('redirect to ', redirect);
        context.res.render('activated', {
            title: 'activated successfully',
            content: 'please login.',
            redirectTo: redirect,
            redirectToLinkText: 'Log in'
        });
    });

    Emailuser.generateVerificationToken = function(user, cb) {
        crypto.randomBytes(64, function(err, buf) {
            cb(err, buf && buf.toString('hex'));
        });
    };

    function emailValidator(err, done) {
        var value = this.email;
        if (value == null)
            return;
        if (typeof value !== 'string')
            return err('string');
        if (value === '') return;
        if (!util.isEmail(value))
            return err('email');
    }

    function joinUrlPath(args) {
        var result = arguments[0];
        for (var ix = 1; ix < arguments.length; ix++) {
            var next = arguments[ix];
            result += result[result.length - 1] === '/' && next[0] === '/' ?
                next.slice(1) : next;
        }
        return result;
    }

    function createVerificationEmailBody(options, cb) {
        var template = loopback.template(options.template);
        var body = template(options);
        cb(null, body);
    }

    Emailuser.removed = function(_uid, cookie, cb) {
        console.log('disable uid', _uid);
        async.waterfall([
                function(callback) {
                    util.set_user_disable(Emailuser, _uid, 'Emailuser', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Emailuser.app.models.Sso, _uid, 'Sso', (err, data) => {
                        callback(err, data);
                    });
                },
                function(data, callback) {
                    util.set_user_disable(Emailuser.app.models.UserInfo, _uid, 'UserInfo', (err, data) => {
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

    Emailuser.remoteMethod(
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
    Emailuser.pagelist = function(filter, page, start, limit, cb) {
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
        Emailuser.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            Emailuser.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    Emailuser.remoteMethod('pagelist', {
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

    Emailuser.createEmailCode = function(mail, cb) {
        async.waterfall([
                function(callback) {
                    console.log('1-----');
                    if (mail.type === 'register' || mail.type === 'resetPwd') {
                        return callback(null,mail.type);
                    } else {
                        return callback(Errs.wrong_code_type);
                    }
                },
                function(data, callback) {
                    Emailuser.findOne({
                        where: {
                            email: mail.email
                        }
                    }, function(err, result) {
                        if (err) {
                            console.log('err3---', err);
                            return callback(err);
                        }
                        if (result) {
                            console.log('find mail user---', result);
                            if(data === 'register') {
                                return callback(Errs.email_not_unique);
                            } else if(data === 'resetPwd') {
                                return callback();
                            } else {
                                return callback(Errs.wrong_code_type);
                            }
                        } else {
                            if(data === 'register') {
                                return callback();
                            } else if(data === 'resetPwd') {
                                return callback(Errs.no_email);
                            } else {
                                return callback(Errs.wrong_code_type);
                            }
                        }
                        return callback();
                    });
                },
                function(callback) {
                    console.log('3-----');
                    var emailcode = Math.random().toString().slice(-6);
                    // var emailcode = '123456';
                    console.log('emailcode', emailcode);
                    //save to redis
                    var Rvalue = {
                        times: 0,
                        code: emailcode
                    };
                    var nowtime = new Date();
                    Rvalue.time = Math.floor(nowtime.getTime() / 1000);
                    redis.set(mail.email, JSON.stringify(Rvalue), 'ex', 10 * 60); //5分钟有效
                    //send to notify
                    var _subject = '邮箱验证'
                    var noti = {
                        "from": "info@mail.aqumon.com",
                        "target": mail.email,
                        "email_addr": mail.email,
                        "subject": _subject,
                        "content": emailcode
                    };
                    util.sendEmailNoti(noti,(err,data)=>{
                        console.log(_subject+'邮件发送结果(err,data)',err,data);
                    });
                    return callback(null, Rvalue);
                }
            ],
            // optional callback
            function(err, results) {
                console.log('4-----');
                cb(err, results);
            });
    }

    Emailuser.remoteMethod('createEmailCode', {
        accepts: {
            arg: 'mail',
            type: 'object',
            required: true,
            'http': {
                source: 'body'
            }
        },
        http: {
            path: '/emailcode',
            verb: 'post'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });

    //使用emailcode重设密码
    Emailuser.resetPwdByCode = function(data,cb) {
        if (!data.password || !data.email || !data.emailcode) {
            return cb(Errs.lack_field);
        }
        async.waterfall([
            function(callback){
                console.log('1--------------');
                util.passwordVerify(data.password).then(()=>{
                        return callback();
                    },(err)=>{
                        return callback(err);
                    }).catch((err)=>{
                        return callback(err);
                    });
            },
            function(callback) {
                console.log('2--------------');
                util.redisFindCode(data['email']).then(function(result){
                    var Rvalue = JSON.parse(result);
                    console.log('Rvalue code---', Rvalue.code);
                    if (Rvalue.code !== data['emailcode']) {
                        Rvalue.times += 1;
                        if (Rvalue.times >= 10) { //试错10次
                            redis.del(data['email']);
                        } else {
                            var timenow = new Date();
                            var timenow_sec = Math.floor(timenow.getTime() / 1000);
                            var newEx = (EMAIL_CODE_EXPIRE - (timenow_sec - Rvalue.time));//更新剩余时间
                            if (newEx <= 0) {
                                newEx = 0;
                            }
                            redis.set(data['email'], JSON.stringify(Rvalue), 'ex', newEx);
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
                });
            },
            function(callback) {
                console.log('3--------------');
                Emailuser.findOne({where:{email:data.email}},(err,user)=> {
                    if(err) {
                        return callback(err);
                    }
                    if(user) {
                        return callback(null,user);
                    } else {
                        return callback(Errs.no_email);
                    }
                })
            },
            function(user,callback) {
                console.log('4--------------');
                Emailuser.app.models.Sso.findById(user.uid,(err,sso)=>{
                    if(err) {
                        return callback(err);
                    }
                    if(!sso) {
                        return callback(Errs.no_user);
                    }
                    const salt = util.generateSalt();
                    const pwd = util.hashPassword(data.password, salt);
                    const pwdRet = Buffer.from(pwd, 'hex').toString('hex');
                    sso.password = pwdRet;
                    sso.salt = Buffer.from(salt, 'hex').toString('hex');
                    sso.pass_reset_time = Math.round(new Date().getTime() / 1000);
                    sso.locked = 0;//unlock user
                    sso.save((err)=>{
                        if(err) {
                            return callback(err);
                        } else {
                            return callback(null,Errs.success);
                        }
                    });
                });
            }
            ],function(err,result){
                console.log('5--------------',err,result);
                return cb(err,result);
            });
        
    }

    Emailuser.remoteMethod('resetPwdByCode', {
        accepts: {
            arg: 'data',
            type: 'object',
            required: true,
            'http': {
                source: 'body'
            }
        },
        http: {
            path: '/newPassword',
            verb: 'post'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });
};