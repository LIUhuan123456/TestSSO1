'use strict';
const util = require('../util');
const Errs = require('../errors');
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

module.exports = function(Phoneuser) {
    //生成短信验证码数字，保存在redis，然后发送给通知系统
    Phoneuser.createSMScode = function(mobile, cb) {
        async.waterfall([
                function(callback) {
                    console.log('1-----');
                    if (mobile.type === 'register' || mobile.type === 'resetPwd' ) {
                        return callback(null,mobile.type);
                    } else {
                        return callback(Errs.wrong_code_type);
                    }
                    if(!mobile.num || !mobile.area) {
                        return callback(Errs.lack_field);
                    }
                },
                function(data, callback) {
                    return callback();
                    // Phoneuser.findOne({
                    //         where: {
                    //             num: mobile.num
                    //         }
                    //     }, function(err, result) {
                    //         if (err) {
                    //             console.log('err3---', err);
                    //             return callback(err);
                    //         }
                    //         if (result) {
                    //             console.log('find phone user---', result);
                    //             if(data === 'register') {
                    //                 return callback(Errs.phone_not_unique);
                    //             } else if(data === 'resetPwd') {
                    //                 return callback();
                    //             } else {
                    //                 return callback(Errs.wrong_code_type);
                    //             }
                    //         } else {
                    //             if(data === 'register') {
                    //                 return callback();
                    //             } else if(data === 'resetPwd') {
                    //                 return callback(Errs.no_mobile);
                    //             } else {
                    //                 return callback(Errs.wrong_code_type);
                    //             }
                    //         }
                    //         return callback();
                    //     });
                },
                function(callback) {
                    console.log('3-----');
                    var smscode = Math.random().toString().slice(-6);
                    // var smscode = '123456';
                    console.log('smscode', smscode);
                    //save to redis
                    var Rvalue = {
                        times: 0,
                        code: smscode
                    };
                    var nowtime = new Date();
                    Rvalue.time = Math.floor(nowtime.getTime() / 1000);
                    redis.set(mobile.area+mobile.num, JSON.stringify(Rvalue), 'ex', 10 * 60); //10分钟有效
                    //send to notify
                    var noti = {
                        from: "sso",
                        target: mobile.area + mobile.num,
                        phone_num: mobile.area + mobile.num,
                        sign_name: "AQUMON智投",
                        template_code: "SMS_97000041",
                        template_param: {
                            "code": smscode
                        }
                    };
                    util.sendSMS(noti,(err,data)=>{
                        var returnBody = JSON.parse(data.result);
                        if(returnBody.Message == 'OK') {
                            data.smscode = smscode;
                        }
                        return callback(err,data);
                    });
                }
            ],
            // optional callback
            function(err, results) {
                console.log('4-----');
                cb(err, results);
            });
    }

    Phoneuser.remoteMethod('createSMScode', {
        accepts: {
            arg: 'mobile',
            type: 'object',
            required: true,
            'http': {
                source: 'body'
            }
        },
        http: {
            path: '/smscode',
            verb: 'post'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });

    //重设密码
    Phoneuser.resetPwdByCode = function(data,cb) {
        if (!data.password || !data.area || !data.num || !data.smscode) {
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
                var mobile_full = data['area']+data['num'];
                util.redisFindCode(mobile_full).then(function(result){
                    var Rvalue = JSON.parse(result);
                    console.log('Rvalue code---', Rvalue.code);
                    if (Rvalue.code !== data['smscode']) {
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
                });
            },
            function(callback) {
                console.log('3--------------');
                Phoneuser.findOne({where:{num:data.num,area:data.area},order:['create_time DESC']},(err,user)=> {
                    if(err) {
                        return callback(err);
                    }
                    if(user) {
                        return callback(null,user);
                    } else {
                        return callback(Errs.no_mobile);
                    }
                })
            },
            function(user,callback) {
                console.log('4--------------');
                Phoneuser.app.models.Sso.findById(user.uid,(err,sso)=>{
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

    Phoneuser.remoteMethod('resetPwdByCode', {
        accepts: {
            arg: 'data',
            type: 'object',
            required: true,
            'http': {
                source: 'body'
            }
        },
        http: {
            path: '/reset_pass',
            verb: 'post'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });
};