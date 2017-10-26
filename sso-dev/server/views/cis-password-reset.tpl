<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
    <style>
    html {overflow-y:scroll;}
    body {margin:0; padding:29px00; font:12px;background:#ffffff;}
    div,dl,dt,dd,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,form,fieldset,input,textarea,blockquote,p{padding:0; margin:0;}
    table,td,tr,th{font-size:12px;}
    li{list-style-type:none;}
    img{vertical-align:top;border:0;}
    ol,ul {list-style:none;}
    h1,h2,h3,h4,h5,h6{font-size:12px; font-weight:normal;}
    address,cite,code,em,th {font-weight:normal; font-style:normal;}

    /*@import url(https://fonts.googleapis.com/earlyaccess/notosanssc.css);*/

    .notosanssc,
    .header,
    .setting-container .body-container li .reset {
        font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", HelveticaNeue, "Helvetica", "roboto", "Hiragino Sans GB", "WenQuanYi Micro Hei", 'Noto Sans SC', sans-serif;
    }

    body {
        max-width: 1024px;
        margin: 0 auto;
    }

    .no-padding {
        padding: 0;
    }

    .header {
        background: #2a3139;
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.3), 0 0 0 0 #bbbbbe;
        width: 100%;
        height: 84px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .header-name {
        font-weight: bold;
        font-size: 17px;
        color: #ffffff;
        letter-spacing: -0.41px;
        line-height: 22px;
        text-align: center;
    }

    .setting-container ol,
    .setting-container ul {
        list-style: none;
    }

    .setting-container .body-container {
        display: flex;
        justify-content: center;
    }

    .setting-container .body-container .title {
        margin-top: 25px;
        font-size: 18px;
        color: #2a3139;
        letter-spacing: -0.43px;
        text-align: center;
        font-weight: bold;
    }

    .note {
        opacity: 0.74;
        font-size: 12px;
        color: #2a3139;
        letter-spacing: -0.29px;
        text-align: left;
        padding-bottom: 5px;
    }

    @media (min-width: 768px) {
        /*        html {
            background-color: #f0f0f0;
        }*/
        .header-name {
            font-size: 20px;
            color: #000000;
            letter-spacing: -0.48px;
            line-height: 22px;
            text-align: center;
        }
        .setting-container .body-container li .item {
            height: 44px;
        }
        form {
            width: 100%;
            padding-left: 14%;
        }
        .header {
            background: #f0f0f0;
            padding-left: 6%;
            justify-content: flex-start;
        }
        .setting-container .body-container .title {
            margin-top: 94px;
            /*font-family: PingFangSC-Regular;*/
            font-size: 24px;
            color: #6a6a6a;
            letter-spacing: 0;
            text-align: left;
        }
        .setting-container .body-container .large-margin-top {
            margin-top: 98px;
        }
        .setting-container .body-container li .item::placeholder {
            color: white;
        }
        .setting-container .body-container li .reset {
           width: 138px;
           height: 44px;
        }
        .setting-container .body-container li {
            width: 446px;
            margin-bottom: 39px;
        }
        .setting-container .body-container li .large-only {
            /*font-family: PingFangSC;*/
            font-size: 18px;
            color: #6a6a6a;
            letter-spacing: 0;
            text-align: left;
        }
    }

    .setting-container .body-container li .item {
        border: 1px solid #dedede;
        border-radius: 3px;
        width: 100%;
        /*width: calc(100% - 10px);*/
        box-sizing: border-box;
        margin: 8px auto;
        padding-left: 10px;
        color: #bebfc2;
    }

    @media (max-width: 768px) {
        .setting-container .body-container li .item {
            height: 38px;
        }
        html {
            background-color: #fff;
        }
        .large-only {
            display: none;
        }
        form {
            width: 100%;
        }
        .setting-container .body-container li {
            width: 80%;
            margin: 0 auto;
        }
        .setting-container .body-container li .reset {
            width: 100%;
            height: 38px;
        }
    }

    .setting-container .body-container li .reset {
        background: #02366f;
        margin-top: 28px;
        border: 0;
        border-radius: 3px;
        color: white;
        font-size: 18px;
        color: #ffffff;
        letter-spacing: -0.43px;
    }
    .setting-container .body-container li .error {
        position: absolute;
        color: #ff3333;
        font-size: 14px;
    }


    </style>
</head>

<body translate="no">
    <div class="header">
        <p class="header-name">康宏证券投资</p>
    </div>
    <div class="setting-container">
        <div class="body-container">
            <form action="<%=accessToken%>" method="post">
                <div class="title">重置密码</div>
                <ul class="no-padding large-margin-top">
                    <li>
                        <div class="large-only">新密码</div>
                        <input type="password" class="item" name="password" placeholder="新密码">
                        <div class="note">请设置8-16位密码（不能全是数字）</div>
                    </li>
                    <li>
                        <div class="large-only">确认新密码</div>
                        <input type="password" class="item" name="confirmation" placeholder="确认新密码">
                        <div class="error" style="display: none;">您的新密码输入不一致</div>
                    </li>
                    <li>
                        <input type="submit" class="reset" value="重置">
                    </li>
                </ul>
            </form>
        </div>
    </div>
    <script src='https://static.aqumon.com/jquery-3.1.1.min.js'></script>
    <script>
    "use strict";

    function samePassword(a, b) {
        return a === b;
    }

    function isEmpty(value) {
        return value.trim() === "";
    }

    function deletePassword() {
        this.password = "";
        this.passwordAgain = "";
    }

    function checkStrong(value) {
        var strength = 0;
        if (value.length >= 8 && value.length <= 16) {
            if (value.match(/[•€£¥ `]/)) {
                return false;
            }
            if (value.match(/^\d+$/)) {
                return false;
            }
            if (value.match(/[a-z]+/)) {
                strength += 1;
            }
            if (value.match(/[A-Z]+/)) {
                strength += 1;
            }
            if (value.match(/[-/:;\(\)$&@"\.,\?!'\[\]\{\}#%\^\*\+=_\\|~<>]+/)) {
                strength += 1;
            }
        }
        if (strength >= 1) {
            return true;
        }
        return false;
    }

    $(document).ready(function() {
        $("input").change(function() {
            $(".error").hide();
        });
        $("form").submit(function(e) {
            var password = $("input:eq(0)").val();
            var confirmPassword = $("input:eq(1)").val();
            var strongEnough = checkStrong(password);
            var same = samePassword(password, confirmPassword);

            if (same === false) {
                $('.error').text('两次输入的密码不一致');
                $(".error").show();
                e.preventDefault();
                return false;
            }

            if (strongEnough === false) {
                // Not Enough password strength
                $(".error").text("密码必须是8-16位英文字母、数字或符号，不能是纯数字");
                $(".error").show();
                e.preventDefault();
                return false;
            } else if (isEmpty(password) === true || isEmpty(confirmPassword) === true) {
                // Handle Empty
                $(".error").text("密码必须是8-16位英文字母、数字或符号，不能是纯数字");
                $(".error").show();
                e.preventDefault();
                return false;
            } else {
                $(".error").hide();
                return true;
            }
        });
    });

    </script>
</body>

</html>
