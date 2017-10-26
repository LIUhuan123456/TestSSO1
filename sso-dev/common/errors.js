'use strict';

const Errs = module.exports = {};
//注册401开头--------------------------
//邮箱已被注册
Errs.email_not_unique = {
    "statusCode": 200,
    "ecode": 401001,
    "message": "Email is not unique."
}

//密码格式错误
Errs.password_format = {
    "statusCode": 200,
    "ecode": 401002,
    "message": "密码必须是8-16位英文字母、数字或符号，不能是纯数字."
}

//手机已被注册
Errs.phone_not_unique = {
    "statusCode": 200,
    "ecode": 401003,
    "message": "Phone number is not unique."
}

//短信验证码错误
Errs.smscode_wrong = {
    "statusCode": 200,
    "ecode": 401004,
    "message": "SMS code wrong."
}

//邮箱验证码错误
Errs.emailcode_wrong = {
    "statusCode": 200,
    "ecode": 401005,
    "message": "Email code wrong."
}

//有非法字段
Errs.illegal_field = {
    "statusCode": 200,
    "ecode": 401006,
    "message": "Have illegal field."
}

//邮箱格式错误
Errs.email_format = {
    "statusCode": 200,
    "ecode": 401007,
    "message": "Wrong email format."
}

//没有这个code类型
Errs.wrong_code_type = {
    "statusCode": 200,
    "ecode": 401008,
    "message": "Wrong code type."
}

//邀请码错误
Errs.wrong_invite_code = {
    "statusCode": 200,
    "ecode": 401009,
    "message": "Wrong invite code."
}

//登录402开头------------------------

Errs.login_unknown = {
    "statusCode": 200,
    "ecode": 402001,
    "code": "LOGIN_FAILED",
    "message": "Unknown wrong."
}
//密码错误
Errs.password_wrong = {
    "statusCode": 200,
    "ecode": 402002,
    "code": "LOGIN_FAILED",
    "message": "Password wrong."
}
//没有这个uid
Errs.no_user = {
    "statusCode": 200,
    "ecode": 402003,
    "message": "No such user."
}
//IP不在白名单
Errs.not_white_ip = {
    "statusCode": 200,
    "ecode": 402004,
    "message": "IP not in whitelist."
}

//IP格式错误
Errs.worng_ip_format = {
    "statusCode": 200,
    "ecode": 402005,
    "message": "Wrong IP format."
}

//没有提供group参数
Errs.group_required = {
    "statusCode": 200,
    "ecode": 402006,
    "message": "Groups is required."
}

//用户已被锁定
Errs.locked_user = {
    "statusCode": 200,
    "ecode": 402007,
    "code": "LOGIN_FAILED",
    "message": "Locked user."
}
//已在其他地方登录
Errs.login_other_place = {
    "statusCode": 401,
    "ecode": 402008,
    "code": "LOGIN_IN_OTHER_PLACE",
    "message": "Login from other place."
}

//无效的token
Errs.invalid_token = {
    "statusCode": 200,
    "ecode": 402009,
    "code": 'INVALID_TOKEN',
    "message": "Invalid token."
}

//邮箱为空
Errs.email_required = {
    "statusCode": 200,
    "ecode": 402010,
    "message": "Email is required."
}

//邮箱没找到
Errs.no_email = {
    "statusCode": 200,
    "ecode": 402011,
    "message": "Email not found."
}

//邮箱未验证
Errs.email_not_verified = {
    "statusCode": 200,
    "ecode": 402012,
    "message": "Email has not been verified."
}

//没有外部登录证明
Errs.empty_credentials = {
    "statusCode": 200,
    "ecode": 402013,
    "message": "Empty credentials."
}

//外部登录证明错误
Errs.wrong_credentials = {
    "statusCode": 200,
    "ecode": 402014,
    "message": "Credentials is not met."
}

//图片验证码错误
Errs.imgcode_wrong = {
    "statusCode": 200,
    "ecode": 402015,
    "message": "IMG code wrong."
}

//手机没找到
Errs.no_mobile = {
    "statusCode": 200,
    "ecode": 402016,
    "message": "Phone num not found."
}


//其他功能403开头---------

//两次新密码不一致
Errs.diff_pass = {
    "statusCode": 200,
    "ecode": 403001,
    "message": "Diff two password."
}

//缺少字段
Errs.lack_field = {
    "statusCode": 200,
    "ecode": 403002,
    "message": "Lack field."
}

//内部服务错误
Errs.server_error = {
    "statusCode": 200,
    "ecode": 403003,
    "message": "Server error."
}

//操作成功
Errs.success = {
    "statusCode": 200,
    "ecode": 100000,
    "message": "Success."
}