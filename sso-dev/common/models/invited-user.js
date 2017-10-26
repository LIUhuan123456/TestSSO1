'use strict';
const Errs = require('../errors');
const async = require('async');
const util = require('../util');
const fs = require('fs');
const path = require("path");
const multiLang = require('../multi_lang');
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
const VIP_EMAIL = fs.readFileSync(path.join(__dirname, '../../server/views/vip-email.html'), 'utf8');
const VIP_ACTIVITY = fs.readFileSync(path.join(__dirname, '../../server/views/vip-activity.html'), 'utf8');
const redis_invitecode_list = process.env.env+'_invite_code';
module.exports = function(Inviteduser) {
    //创建邀请码
    Inviteduser.createInviteCode = function(req,cb) {
        async.waterfall([
            function(callback) {
                redis.llen(redis_invitecode_list,function(err,result){
                    console.log('llen err,result:',err,result);
                    if(err) {
                        return callback(Errs.server_error);
                    } else {
                        return callback(null,result);
                    }
                });
            },
            function(result, callback) {
                console.log('redis_invitecode_list',redis_invitecode_list);
                var invite_code = 10000;
                if(0 == result) {
                    var filter = {
                        order: ['create_time DESC'],
                    }
                    Inviteduser.findOne(filter,function(err,user) {
                        if(err) {
                            console.log('findOne err:',err);
                        }
                        if(!user) {
                            invite_code = 10001;
                        } else {
                            invite_code = parseInt(user.invite_code) + 1;
                        }
                        redis.rpush(redis_invitecode_list,invite_code);
                        return callback(null,invite_code);
                    });
                } else {
                    redis.lindex(redis_invitecode_list,-1,function(err,result){
                        if(err) {
                            return callback(Errs.server_error);
                        }
                        invite_code = parseInt(result) + 1;
                        redis.rpush(redis_invitecode_list,invite_code);
                        return callback(null,invite_code);
                    });
                }
            }
        ],
        function(err, results) {
            cb(err, {invite_code:results});
        });
    }

    Inviteduser.remoteMethod('createInviteCode', {
        accepts: {
            arg: 'req',
            type: 'string'
        },
        http: {
            path: '/invitecode',
            verb: 'post'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });
    //创建用户后发送邮件
    Inviteduser.afterRemote('create', function(context, userInstance, next) {
        console.log('> user.afterRemote triggered');
        console.log('context.req',context.req.body);
        var filter = {
            where:{uid:userInstance.uid}
        };

        Inviteduser.app.models.Sso.findOne(filter,(err,result)=>{
            if(err) {
                return next(err);
            }
            if(!result) {
                return next(Errs.no_user);
            }
            var ttl = 48 * 60 * 60; //48 hour
            result.createAccessToken(ttl, function(err, accessToken) {
                if (err) {
                    return next(err);
                }
                var url = `${context.req.headers.origin}/v1/Inviteduser/set_password?access_token=${accessToken.id}&lang=${context.req.body.lang}`;
                console.log('url---',url);
                var html = VIP_EMAIL.replace(/{{link}}/g, url).replace('{{name}}',userInstance.full_name).replace('{{code}}',userInstance.invite_code);
                
                var _subject = 'AQUMON VIP專屬賬戶激活';
                if(context.req.body.lang == 'chs') {

                } else if(context.req.body.lang == 'cht') {
                    html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_mail_cht[s1];});
                } else if(context.req.body.lang == 'en') {
                    _subject = 'AQUMON VIP Account Activation';
                    html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_mail_en[s1];});
                }
                var noti = {
                    "from": "info@mail.aqumon.com",
                    "target": userInstance.email,
                    "email_addr": userInstance.email,
                    "subject": _subject,
                    "result": "string",
                    "content": html
                };
                util.sendEmailNoti(noti,(err,data)=>{
                    console.log(_subject+'邮件发送结果(err,data)',err,data);
                });
                if(userInstance.attend_activity) {
                    var html2 = VIP_ACTIVITY.replace('{{name}}',userInstance.full_name);
                    var _subject2 = 'AQUMON VIP之夜邀請函';
                    if(context.req.body.lang == 'chs') {

                    } else if(context.req.body.lang == 'cht') {
                        html2 = html2.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_activity_cht[s1];});
                    } else if(context.req.body.lang == 'en') {
                        _subject2 = 'Invitation to AQUMON VIP’s Night';
                        html2 = html2.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_activity_en[s1];});
                    }
                    var noti2 = {
                        "from": "info@mail.aqumon.com",
                        "target": userInstance.email,
                        "email_addr": userInstance.email,
                        "subject": _subject2,
                        "result": "string",
                        "content": html2
                    };
                    util.sendEmailNoti(noti2,(err,data)=>{
                        console.log(_subject2+'邮件发送结果(err,data)',err,data);
                    });
                }
                return next();
            });
        });
    });
};
