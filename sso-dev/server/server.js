'use strict';

require('./boot');
const loopback = require('loopback');
const boot = require('loopback-boot');
const util = require('../common/util');
const common = require('../common/common');
const async = require('async');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const logger = require('../common/logger');
const multiLang = require('../common/multi_lang');
const path = require("path");
const fs = require('fs');
const session = require('express-session');


const app = module.exports = loopback();

// Passport configurators..
var loopbackPassport = require('loopback-component-passport');
var PassportConfigurator = loopbackPassport.PassportConfigurator;
var passportConfigurator = new PassportConfigurator(app);
passportConfigurator.init();
// attempt to build the providers/passport config
var config = {};
try {
    config = require('../providers.json');
} catch (err) {
    console.trace(err);
    process.exit(1); // fatal
}

app.use(session({
  secret: 'random 1238 128 bytes random string', // 建议使用 128 个字符的随机字符串
  cookie: { maxAge: 60 * 60 * 1000 },//毫秒
  saveUninitialized: true,
  resave: true,
  name: 'sessionId'
}));
// app.use(cors());
app.set('view engine', 'ejs');
// set the folder where templates can be found
app.set('views', __dirname + '/views');
// configure body parser
app.use(bodyParser.urlencoded({
    extended: true
}));
// app.set('cookieSecret', 'kitty');
app.use(cookieParser('cookieSecret'));
app.use(loopback.token({
    model: app.models.AccessToken,
    currentUserLiteral: 'me'
}));


//记录全部进来的请求
app.use(function logRes(req, res, next) {
    logger.loga.info(req.ip + ':' + req.client._peername.port + ' - - ' + req.method + ' - ' + req.url + ' | X-requestid:' + req.headers['x-requestid'] + ' | cookie: ' + req.headers.cookie);
    return next();
});
const TOKEN_EXPIRED = fs.readFileSync(path.join(__dirname, './views/token-expired.html'), 'utf8');
const VIP_TOKEN_EXPIRED = fs.readFileSync(path.join(__dirname, './views/vip-token-expired.html'), 'utf8');
app.use(function accessTokenProlongation(req, res, next) {
    console.log("req.url:", req.url);
    // if(req.url.indexOf("/v1/sso/login") !== -1) {
    //     this.destroy(function(err) {
    //       cb(err, isValid);
    //     });
    //     return next();
    // }
    var token = req.accessToken,
        now = new Date(),
        createTS = token ? token.created.getTime() : 0,
        expiredTS = token ? req.accessToken.ttl * 1000 : 0;
        // dayTS = 24 * 60 * 60 * 1000;
    console.log('acctoken---',req.accessToken);
    if (!token || (token && (createTS + expiredTS < now))) {
        if (req.url.indexOf('/v1/users/reset_password') !== -1) { //康宏的失效页面
            if (req.hostname.indexOf('cissecurities') !== -1 || req.hostname.indexOf('convoy') !== -1) {
                var html = TOKEN_EXPIRED;
                return res.render('blank', {
                    content: html
                });
            } else {
                return next();
            }
        } else if(req.url.indexOf('/v1/Inviteduser/set_password') !== -1) {//VIP设置密码请求
            var lang = req.query.lang;
            var url = `https://${req.headers.host}`;
            // console.log('req.origin--',req);
            var html = VIP_TOKEN_EXPIRED.replace(/{{link}}/g, url);
            // console.log('html',html);
            if(lang === 'en') {
                html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_token_expired_en[s1];});
            } else if(lang === 'chs'){

            } else if(lang === 'cht') {
                html = html.replace(/{{([^}]*)}}/g,function(s,s1){return multiLang.vip_token_expired_cht[s1];});
            }
            return res.render('blank', {
                content: html
            });
        } else {
            return next();
        }
        // return next();
    }
    // console.log('accessTokenProlongation2');
    // if (now.getTime() - createTS < dayTS) {
    //     return next();
    // }

    //"/v1/users/1000000098/accounts/264/public_target"
    var regexp1 = /\/v1\/users\/\d{1,}\/accounts\/\d{1,}\/public_target/i;
    //"/v1/users/1000000098/accounts/256/public_portfolio"
    var regexp2 = /\/v1\/users\/\d{1,}\/accounts\/\d{1,}\/public_portfolio/i;
    //"/v1/users/1000000098/accounts/defaultaccount"
    var regexp3 = /\/v1\/users\/\d{1,}\/accounts\/defaultaccount/i;
    //"/v1/users/1000000098/accounts/264/portfolio"
    var regexp4 = /\/v1\/users\/\d{1,}\/accounts\/\d{1,}\/portfolio/i;
    //"/v1/users/:uid/accounts/:account/target"
    var regexp5 = /\/v1\/users\/\d{1,}\/accounts\/\d{1,}\/target/i;

    if (req.url.search(regexp1) !== -1) {
        console.log("Dont refresh token!");
        return next();
    } else if (req.url.search(regexp2) !== -1) {
        console.log("Dont refresh token!");
        return next();
    } else if (req.url.search(regexp3) !== -1) {
        console.log("Dont refresh token!");
        return next();
    } else if (req.url.search(regexp4) !== -1) {
        console.log("Dont refresh token!");
        return next();
    } else if (req.url.search(regexp5) !== -1) {
        console.log("Dont refresh token!");
        return next();
    }

    if (token.created.getTime() !== 0) {
        token.updateAttribute('created', now, next);
        console.log("Token refreshed!");
    }

});



app.start = function() {
    // start the web server
    return app.listen(function() {
        app.emit('started');
        var baseUrl = app.get('url').replace(/\/$/, '');
        var logg = 'Web start. Listening at' + baseUrl;
        console.log(logg);
        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;
            console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
        }
    });
};

process.on('uncaughtException', function(err) {
    console.error(err.stack);
    logger.loge.info(err.stack);
    console.log("Node NOT Exiting...");
});

// require('./notiServer')(app);

const setConfig = function(_name, _data) {
    try {
        app.set(_name, JSON.parse(_data));
    } catch (err) {
        console.log(err);
        throw new Error(`Error, could not initiate config ${_name} by ${_data}`);
    }
}
const configBase = process.env.name;
async.waterfall([
    function(cb) {
        cb(null);
    },
    function(dbcallback) {
        util.getZKConfig(`/${configBase}/config/user_center/db`, (err, data) => {
            setConfig('config_uc_db', data);
            dbcallback(null);
        });
    },
    function(domaincallback) {
        util.getZKConfig(`/${configBase}/config/domain`, (err, data) => {
            setConfig('config_domain', data);
            domaincallback(null);
        });
    },
    function(uidomaincallback) {
        util.getZKConfig(`/${configBase}/config/ui-domain`, (err, data) => {
            setConfig('config_uidomain', data);
            uidomaincallback(null);
        });
    },
    function(logincallback) {
        util.getZKConfig(`/${configBase}/config/login-address`, (err, data) => {
            app.set('config_login_address', data);
            logincallback(null);
        });
    },
    function(productcallback) {
        util.getZKConfig(`/${configBase}/config/product`, (err, data) => {
            setConfig('config_product', data);
            productcallback(null);
        });
    },
    function(accountcallback) {
        util.getZKConfig(`/${configBase}/config/account/endpoint`, (err, data) => {
            const service = util.parseHttp(data);
            if (service) {
                app.set('config_service_account', service);
            } else {
                throw new Error(`Error, could not initiate config config_service_account`);
            }
            accountcallback(null);
        });
    },
    function(questionnairecallback) {
        util.getZKConfig(`/${configBase}/config/questionnaire/endpoint`, (err, data) => {
            const service = util.parseHttp(data);
            if (service) {
                app.set('config_service_questionnaire', service);
                console.log('config_service_questionnaire', app.get('config_service_questionnaire'));
            } else {
                throw new Error(`Error, could not initiate config config_service_questionnaire`);
            }
            questionnairecallback(null);
        });
    },
    //读取钉钉POST url
    function(dingMsgcallback) {
        util.getZKConfig(`/${configBase}/config/notification/dingding`, (err, data) => {
            setConfig('config_ding_post', data);
            dingMsgcallback(null);
        });
    }
], function(err, result) {
    // Bootstrap the application, configure models, datasources and middleware.
    // Sub-apps like REST API are mounted via boot scripts.
    common.setConfig(app);
    boot(app, __dirname, function(err) {
        //Oauth 第三方登录设置
        passportConfigurator.setupModels({
            userModel: app.models.Sso,
            userIdentityModel: app.models.userIdentity,
            userCredentialModel: app.models.userCredential
        });
        for (var s in config) {
            var c = config[s];
            c.session = c.session !== false;
            c.profileToUser = function(provider, profile, options) {
                // console.log('provider====', provider);
                // console.log('profile====', profile);
                // console.log('options====', options);
                var _oid = 1;
                if(profile.from.indexOf('huarun') != -1) {
                    _oid = 2;
                } else if(profile.from.indexOf('guodu') != -1) {
                    _oid = 3;
                } else if(profile.from.indexOf('convoy') != -1 || profile.from.indexOf('cissecurities') != -1) {
                    _oid = 4;
                }
                var _email = profile.emails[0].value;
                var username, domain;
                [username, domain] = _email.split('@');
                if (domain !== 'magnumwm.com') {
                    return {
                        email: 'unverify_email'
                    }
                }
                return {
                    xing: profile.name.familyName,
                    name: profile.name.givenName,
                    password: 'secret',
                    type: 100,
                    product: profile.from,
                    oid:_oid,
                    email: _email
                }
            };
            passportConfigurator.configureProvider(s, c);
        }
        if (err) {
            throw err;
        }
        // start the server if `$ node server.js`
        if (require.main === module)
            app.start();

        
    });
});