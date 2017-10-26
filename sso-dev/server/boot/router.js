const util = require('../../common/util');
const http = require('http');
const app = require('../server');
const domain = app.get('config_domain');
const uiDomain = app.get('config_uidomain');
const logger = require('../../common/logger');
const multiLang = require('../../common/multi_lang');
// const multiparty = require('multiparty');
// const AccessToken = require('loopback/common/models/A')
const ERR_AUTHORIZATION_REQUIRED = {
    "error": {
        "statusCode": 401,
        "name": "Error",
        "message": "Authorization Required",
        "code": "AUTHORIZATION_REQUIRED"
    }
};


module.exports = function(app) {
    const router = app.loopback.Router();
    const AccessTokenModel = app.models.AccessToken;

    router.all('/v1/users/:id/accounts/*', function(req, res) {
        // console.log('here!!!');
        logger.logf.info(req.ip + ':' + req.client._peername.port + ' - - ' + req.method + ' - ' + req.url + ' | X-requestid:' + req.headers['x-requestid'] + ' | cookie: ' + req.headers.cookie);
        AccessTokenModel.findForRequest(req, {}, (err, token) => {
            if (err || !token) {
                console.log(err);
                res.status(401).send(ERR_AUTHORIZATION_REQUIRED);
                return;
            }
            token.validate((tokenErr, isValid) => {
                if (!err && isValid) {
                    const connector = http.request({
                        host: app.get('config_service_account').host,
                        path: req.url,
                        port: app.get('config_service_account').port,
                        method: req.method,
                        headers: req.headers
                    }, (resp) => {
                        res.writeHead(resp.statusCode, resp.headers);
                        resp.pipe(res);
                    });
                    req.pipe(connector);

                } else {
                    console.log(err);
                    res.status(401).send(ERR_AUTHORIZATION_REQUIRED);
                    return;
                }
            })
        })
    });

    router.all('/v1/users/:id/questionnaire|risk_type/*', function(req, res) {
        // console.log('here!!!');
        logger.logf.info(req.ip + ':' + req.client._peername.port + ' - - ' + req.method + ' - ' + req.url + ' | X-requestid:' + req.headers['x-requestid'] + ' | cookie: ' + req.headers.cookie);
        AccessTokenModel.findForRequest(req, {}, (err, token) => {
            if (err || !token) {
                console.log(err);
                res.status(401).send(ERR_AUTHORIZATION_REQUIRED);
                return;
            }
            token.validate((tokenErr, isValid) => {
                if (!err && isValid) {
                    const connector = http.request({
                        host: app.get('config_service_questionnaire').host,
                        path: req.url,
                        port: app.get('config_service_questionnaire').port,
                        method: req.method,
                        headers: req.headers
                    }, (resp) => {
                        res.writeHead(resp.statusCode, resp.headers);
                        resp.pipe(res);
                    });

                    req.pipe(connector);
                } else {
                    console.log(err);
                    res.status(401).send(ERR_AUTHORIZATION_REQUIRED);
                    return;
                }
            })
        })
    });

    const path = require("path");
    const ejs = require('ejs');
    const fs = require('fs');
    const TPL_PASSWORD_INFO = fs.readFileSync(path.join(__dirname, '../views/password-reset.tpl'), 'utf8');
    const TPL_PASSWORD_DONE = fs.readFileSync(path.join(__dirname, '../views/password-reset-done.tpl'), 'utf8');
    const CIS_TPL_PASSWORD_INFO = fs.readFileSync(path.join(__dirname, '../views/cis-password-reset.tpl'), 'utf8');
    const CIS_TPL_PASSWORD_DONE = fs.readFileSync(path.join(__dirname, '../views/cis-password-reset-done.tpl'), 'utf8');
    const VIP_PASS_SET = fs.readFileSync(path.join(__dirname, '../views/vip-password-set.html'), 'utf8');
    const VIP_PASS_DONE = fs.readFileSync(path.join(__dirname, '../views/vip-password-done.html'), 'utf8');

    //VIP邀请修改密码页面
    router.get('/v1/Inviteduser/set_password', function(req, res, next) {
        if (!req.accessToken) return res.sendStatus(401);
        console.log('reqaccessToken---', req.accessToken);
        var lang = req.query.lang;
        console.log("req.lang:", lang);
        const app = require('../server');
        const domain = app.get('config_domain');
        var url = `/v1/Inviteduser/set_password?access_token=${req.accessToken.id}&lang=${lang}`;
        var html = VIP_PASS_SET.replace('{{accessToken}}', url);
        if(lang === 'en') {
            html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_password_set_en[s1];});
        } else if(lang === 'chs'){

        } else if(lang === 'cht') {
            html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_password_set_cht[s1];});
        }
        res.render('blank', {
            content: html
        });
    });
    //VIP邀请修改密码请求
    router.post('/v1/Inviteduser/set_password', function(req, res, next) {
        if (!req.accessToken) return res.sendStatus(401);
        //verify passwords match
        if (!req.body.password ||
            !req.body.confirmation ||
            req.body.password !== req.body.confirmation) {
            return res.status(400).send('修改密码错误：两次输入的密码不匹配');
        }
        var lang = req.query.lang;
        console.log("req.lang:", lang);
        //康宏的密码规则
        let strength = 0;
        if (req.body.password.length >= 8 && req.body.password.length <= 16) {
            if (req.body.password.match(/^\d+$/)) {
                return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
            }
            if (req.body.password.match(/[a-z]+/)) {
                strength++;
            }
            if (req.body.password.match(/[A-Z]+/)) {
                strength++;
            }
            if (req.body.password.match(/[-/:;\(\)$&@"\.,\?!'\[\]\{\}#%\^\*\+=_\\|~<>]+/)) {
                strength++;
            }
        } else {
            return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
        }
        if (strength < 1) {
            return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
        }

        app.models.Sso.findById(req.accessToken.userId, function(err, sso) {
            if (err) return res.sendStatus(404);
            const salt = util.generateSalt();
            const pwd = util.hashPassword(req.body.password, salt);
            const pwdRet = Buffer.from(pwd, 'hex').toString('hex');
            sso.password = pwdRet;
            sso.salt = Buffer.from(salt, 'hex').toString('hex');
            sso.pass_reset_time = Math.round(new Date().getTime() / 1000);
            sso.locked = 0;//unlock user
            // const redirect = uiDomain.protocol + '://' + uiDomain.host + '/' + app.get('config_login_address');
            // console.log('redirect to ', redirect);
            sso.save(function(err) {
                if (err) {
                    console.log(err);
                    res.sendStatus(404);
                } else {
                    console.log('> password reset processed successfully');
                    app.models.PhoneUser.findById(req.accessToken.userId, function(err, phone) {
                        if(err) {
                            console.log(err);
                            res.sendStatus(404);
                        }
                        // console.log('findById--',phone);
                        var url = `${req.headers.origin}?area=${phone.area}&num=${phone.num}&lang=${lang}`;
                        var html = VIP_PASS_DONE.replace(/{{link}}/g, url);
                        if(lang === 'en') {
                            html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_password_done_en[s1];});
                        } else if(lang === 'chs'){

                        } else if(lang === 'cht') {
                           html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_password_done_cht[s1];});
                        }
                        res.render('blank', {
                            content: html
                        });

                    });
                    
                    // res.render('response', {
                    //     title: 'Password reset success',
                    //     content: '您的密码设置成功',
                    //     redirectTo: '/',
                    //     redirectToLinkText: 'Log in'
                    // });
                }
            });
        });
    });

    //修改密码页面
    router.get('/v1/users/reset_password', function(req, res, next) {
        if (!req.accessToken) return res.sendStatus(401);
        console.log('req---', req.hostname);
        const app = require('../server');
        const domain = app.get('config_domain');
        var url = `/v1/users/reset_password?access_token=${req.accessToken.id}`;
        var html = TPL_PASSWORD_INFO.replace('<%=accessToken%>', url);
        // if (req.hostname.indexOf('cissecurities.aqumon.com') !== -1 || req.hostname.indexOf('192.168.0.155') !== -1) {
        if (req.hostname.indexOf('cissecurities.aqumon.com') !== -1 || req.hostname.indexOf('convoy.aqumon.com') !== -1) {
            html = CIS_TPL_PASSWORD_INFO.replace('<%=accessToken%>', url);
        }
        res.render('blank', {
            content: html
        });
    });

    //reset the user's pasword
    router.post('/v1/users/reset_password', function(req, res, next) {
        if (!req.accessToken) return res.sendStatus(401);
        //verify passwords match
        if (!req.body.password ||
            !req.body.confirmation ||
            req.body.password !== req.body.confirmation) {
            return res.status(400).send('修改密码错误：两次输入的密码不匹配');
        }

        //康宏的密码规则
        let strength = 0;
        if (req.body.password.length >= 8 && req.body.password.length <= 16) {
            if (req.body.password.match(/^\d+$/)) {
                return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
            }
            if (req.body.password.match(/[a-z]+/)) {
                strength++;
            }
            if (req.body.password.match(/[A-Z]+/)) {
                strength++;
            }
            if (req.body.password.match(/[-/:;\(\)$&@"\.,\?!'\[\]\{\}#%\^\*\+=_\\|~<>]+/)) {
                strength++;
            }
        } else {
            return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
        }
        if (strength < 1) {
            return res.status(400).send('修改密码错误：密码必须是8-16位英文字母、数字或符号，不能是纯数字');
        }

        app.models.Sso.findById(req.accessToken.userId, function(err, sso) {
            if (err) return res.sendStatus(404);
            const salt = util.generateSalt();
            const pwd = util.hashPassword(req.body.password, salt);
            const pwdRet = Buffer.from(pwd, 'hex').toString('hex');
            sso.password = pwdRet;
            sso.salt = Buffer.from(salt, 'hex').toString('hex');
            sso.pass_reset_time = Math.round(new Date().getTime() / 1000);
            sso.locked = 0;//unlock user
            // const redirect = uiDomain.protocol + '://' + uiDomain.host + '/' + app.get('config_login_address');
            // console.log('redirect to ', redirect);
            sso.save(function(err) {
                if (err) {
                    console.log(err);
                    res.sendStatus(404);
                } else {
                    console.log('> password reset processed successfully');
                    var html = TPL_PASSWORD_DONE;
                    // if (req.hostname.indexOf('cissecurities.aqumon.com') !== -1 || req.hostname.indexOf('192.168.0.155') !== -1) {
                    if (req.hostname.indexOf('cissecurities.aqumon.com') !== -1 || req.hostname.indexOf('convoy.aqumon.com') !== -1) {
                        html = CIS_TPL_PASSWORD_DONE;
                    }
                    res.render('blank', {
                        content: html
                    });
                    // res.render('response', {
                    //     title: 'Password reset success',
                    //     content: '您的密码设置成功',
                    //     redirectTo: '/',
                    //     redirectToLinkText: 'Log in'
                    // });
                }
            });
        });
    });

    app.use(router);
};