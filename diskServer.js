const fs = require("fs-extra");
const http = require("http");
const https = require("https");
const url = require("url");
const RT = require("randomthing-js");
const ResetPassword = new (require("./modules/VerifyCode"))();
const RegisterVerify = new (require("./modules/VerifyCode"))();
const mailer = require("nodemailer");
const cookie = require("cookie");
const WebSocket = require("ws").Server;
const path = require("path");
const CS = require("./modules/CommandSystem");
const PBIP = require("./modules/provisionalBanip");
const LFL = require("./modules/LoginFailedLimit");
const fileNameFilter = new RegExp('[\\\\/:*?\"<>|]');//文件名过滤
const emailReg = new RegExp("^[a-zA-Z0-9]+([-_.][A-Za-zd]+)*@([a-zA-Z0-9]+[-.])+[A-Za-zd]{2,5}$");//邮箱
// 写完readme创建仓库 把about里的链接改了
//独立的开放源代码许可页
/**
 * @description 只允许大小写字母 数字
 */
const spWordFilter = new RegExp("^[0-9a-zA-Z]+$");
//socket http头
const httpHeader = "HTTP/1.1 200\r\nContent-Type: application/json; charset=utf-8\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\n";
let storagePath;
/**
 * @description 正在上传文件用户列表
 * @export uploadingUserToken
 * @type {Map}
 */
let uploadingUserToken = new Map();
//账户注销时清空分享 
// 配置信息
let serverConfig;
//统计信息
const statistics = { download: 0, upload: 0, loginCount: 0, streamMedia: 0, newShare: 0, register: 0 };
//https是否启动成功
let httpsWorking;
// https服务器
let httpsServer;
// 共享文件列表
let publicFileList;
//日志模块
let logCore;
//命令模块实例
let commandSystemInstance;
/**
 * @description https用 后台Websocket
 * @export bgWebsocket
 * @type {WebSocket}
 */
let bgWebsocket=null;
//列表banip
/**
 * @description 列表banip
 * @export banip
 * @type {Set}
 */
let banip;
//临时banip
/**
 * @description 临时banip管理实例
 * @export provisionalBanip
 * @type {PBIP}
 */
let provisionalBanip;
/**
 * @description 多次登录失败处理
 * @type {LFL}
 */
let loginFailedLimit;
//modules
let nickNameExamineInstance;//昵称审核实例
let shareCoreInstance;//分享管理实例
let sensitiveWordsFilterInstance;//屏蔽词模块实例
let limitRegEveryday = new Map();//注册限制
const shareCore = require("./modules/Shares.js");
const nickNameExamine = require("./modules/NickNameExamine.js");
const sensitiveWordsFilter = require("./modules/StringFilter.js");
const windowsFilterName = process.platform === "win32" ? new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]) : void (0);
const configKeys = new Set(["debug", "enableHTTPS", "enabledWebBackground", "autoSaveTimer", "enableShare", "enableRegister", "enabledStreamMedia", "enableNickName"
    , "randomBackgroundPort", "backgroundPort", "backgroundLoginGUI", "backgroundLoginKey", "backgroundRandomKey", "storagePath", "enableResetPassword",
    "changeNicknameExamine", "maxLogArrayLength", "mailerConfig", "onlyLocalhostBackground", "registerVerify", "enableBanipTips", "banipTipsText", "autoProvisionalBanip", "provisionalBanipTime", "defaultNewUserStorage", "maxEverydayRigister",
    "limitRegisterEveryday", "loginFailedLimitTime"]);
//xss敏感词
const xssWord = ["<", ">", "=", "/", "\\", '"', "javascript:"];
//控制台用 账户配置列表
const userConfigsList = new Set(["password", "permission", "storage", "nickName", "email", "uaDetectEnable", "ua", "onUserAgentDetectFailed", "enabled", "enableShare"])
console.log("Disk server starting...");
//assets
const ico = fs.readFileSync("./assets/logo.ico");//icon
const loginPage = fs.readFileSync("./assets/html/login.html");
const loginCss = fs.readFileSync("./assets/css/login.css");
const authenticationFailed = fs.readFileSync("./assets/html/authenticationFailed.html");
const authenticationSucceed = fs.readFileSync("./assets/html/authenticationSucceed.html");
const diskHtml = fs.readFileSync("./assets/html/userDisk.html");
const mainDiskCss = fs.readFileSync("./assets/css/mainDisk.main.css");
const mediaSubWindow = fs.readFileSync("./assets/html/mediaSubWindow.html");
const userCenter = fs.readFileSync("./assets/html/userCenter.html");
const shareInfoHtml = fs.readFileSync("./assets/html/shareInfo.html");
const destroyAccountHtml = fs.readFileSync("./assets/html/destroyAccount.html");
const aboutHtml = fs.readFileSync("./assets/html/about.html");
//js
//用户主页
const homeScript = fs.readFileSync("./assets/js/disk/home.js");
//用户中心
const userCenterScript = fs.readFileSync("./assets/js/disk/userCenter.js");
//css
//用户中心
const userCenterStyle = fs.readFileSync("./assets/css/userCenter.css");
//注册无验证码
const regAccountHtml = fs.readFileSync("./assets/html/regAccount.html");
//注册带验证码
const regAccountHasVerifyHtml = fs.readFileSync("./assets/html/regAccountHasVerify.html");
//停用注册
const registerAccountDisabledHtml = fs.readFileSync("./assets/html/registerDisabled.html");
const fastTracker_playerHtml = fs.readFileSync("./assets/html/ft2Player.html");
//xm播放
const fastTracker_playerMainScript = fs.readFileSync("./assets/js/fastTrackerPlayer/ft2.js");
const fastTracker_playerUtilScript = fs.readFileSync("./assets/js/fastTrackerPlayer/utils.js");
const fastTracker_playerScript = fs.readFileSync("./assets/js/fastTrackerPlayer/player.js");
//正常html
const publicFileListHtml = fs.readFileSync("./assets/html/publicFile.html");
const resetPasswordHtml = fs.readFileSync("./assets/html/resetPassword.html");
//停用重置密码时html
const disabledResetPasswordHtml = fs.readFileSync("./assets/html/disabled_resetPassword.html");
//开关图片
const switchBitmapTrue = fs.readFileSync("./assets/bitmap/html_switch_true.png");
const switchBitmapFasle = fs.readFileSync("./assets/bitmap/html_switch_false.png");
// spc播放
const spcPlayerHtml = fs.readFileSync("./assets/html/spcPlayer.html");
const spcPlayerJavaScript = fs.readFileSync("./assets/js/spc700/spc.js");
const spcPlayerWasm = fs.readFileSync("./assets/js/spc700/spc.wasm");
//音频元数据
const webAudioMetadataReader=fs.readFileSync("./assets/js/mediaMetadata/core.js");
//开源许可
const openSourceHtml=fs.readFileSync("./assets/html/openSource.html");
//读取配置信息
console.log("Loading config file...");
try {
    serverConfig = fs.readJsonSync("./config.json");
    storagePath = serverConfig.storagePath;
    fs.ensureDirSync("./_logs/");
    fs.ensureDirSync("./_server_data/");
    fs.ensureDirSync("./_deletedFiles");
    logCore = new (require("./modules/logCore"))("./_logs/server.log", serverConfig.debug, serverConfig.maxLogArrayLength, 10492, process.argv[2], serverConfig.enableHTTPS);
    //临时banip列表
    provisionalBanip = new PBIP(serverConfig.provisionalBanipTime || 300000, serverConfig.autoProvisionalBanip);
    //登录失败处理
    loginFailedLimit = new LFL(serverConfig.loginFailedLimitTime);
    if (serverConfig.debug) logCore.writeLog("Debug logs Enabled");
    logCore.writeInfo("Initialzed config");
    if (serverConfig.enableResetPassword) {
        for (let value of Object.values(serverConfig.mailerConfig)) {
            if (value === null) {
                logCore.writeWarn("发件功能未正确配置 将无法发送邮件验证码 请检查相关配置或停用重置密码功能");
                break
            }
        }
    }
} catch (err) {
    console.log(err);
    console.log(`Failed to load config file.Server start failed.\nException:${err}`);
    process.exit(0);
}
/**
 * @description 注册用户列表
 * @export regUsers
 * @type {Map}
 */
let regUsers;
//regUsers初始化
try {
    logCore.writeLog("Loading registered users...");
    regUsers = new Map();
    if (!fs.existsSync("./_server_data/regUsers.json")) throw new Error("File");
    let regJson = fs.readJsonSync("./_server_data/regUsers.json");
    let regJsonKeys = Object.keys(regJson);
    for (let data of regJsonKeys) {
        regUsers.set(data, regJson[data]);
    }
    logCore.writeInfo(`Initialzed registered users:${regJsonKeys.length}`);
    //rel
    regJson = null;
    regJsonKeys = null;
} catch (error) {
    if (error.message === "File") {
        fs.writeFileSync("./_server_data/regUsers.json", "{}", { encoding: "utf-8" });
        regUsers = new Map();
        logCore.writeLog("Register users mapping file created");
    } else {
        throw error
    }
}
/**
 * @description 用户登录Token
 * @export userTokens
 * @type {Map}
 */
let userTokens;
//tokens初始化
try {
    logCore.writeLog("Loading user tokens...");
    userTokens = new Map();
    let tokenJson = fs.readJsonSync("./_server_data/userTokens.json");
    let tokenJsonKeys = Object.keys(tokenJson);
    for (let data of tokenJsonKeys) {
        userTokens.set(data, tokenJson[data]);
    }
    logCore.writeInfo(`Initialzed user tokens:${tokenJsonKeys.length}`);
    //rel
    tokenJson = null;
    tokenJsonKeys = null;
} catch (error) {
    if (error.code === "ENOENT") {
        fs.writeFileSync("./_server_data/userTokens.json", "{}", { encoding: "utf-8" });
        userTokens = new Map();
        logCore.writeLog("User token mapping file created");
    } else {
        throw error
    }
}
//确保存储文件夹存在
fs.ensureDirSync(storagePath);
for (let enDir of regUsers.keys()) {
    fs.ensureDirSync(`${storagePath}${enDir}/`)
}
//计算各用户剩余存储空间
let freeSpace = new Map();
logCore.writeLog("Computing free space...");
(async function () {
    for (let users of regUsers.keys()) {
        let userFree = await computeSpace(`${storagePath}${users}/`, users);
        freeSpace.set(users, { total: userFree.total, free: Math.abs(userFree.total - userFree.used) });
    }
})();
//昵称审核列表初始化
if (fs.existsSync("./_server_data/nickName_examine.json")) {
    nickNameExamineInstance = new nickNameExamine(fs.readJSONSync("./_server_data/nickName_examine.json"));
    logCore.writeInfo("Examine list initialized");
} else {
    fs.writeFileSync("./_server_data/nickName_examine.json", "[]", { encoding: "utf-8" });
    logCore.writeLog("Examine list created");
    nickNameExamineInstance = new nickNameExamine([]);

}
//屏蔽词列表初始化
if (fs.existsSync("./assets/sensitiveWords.json")) {
    sensitiveWordsFilterInstance = new sensitiveWordsFilter(fs.readJsonSync("./assets/sensitiveWords.json"));
    logCore.writeInfo("Sensitive words initialized")
} else {
    fs.writeFileSync("./assets/sensitiveWords.json", "[]", { encoding: "utf8" });
    logCore.writeLog("Created empty sensitive words list");
    sensitiveWordsFilterInstance = new sensitiveWordsFilter([]);
}
//用户分享列表初始化
if (fs.existsSync("./_server_data/shares.json")) {
    logCore.writeLog("Loading shares list...");
    shareCoreInstance = new shareCore(fs.readJsonSync("./_server_data/shares.json"), storagePath);
    shareCoreInstance.clearTimeoutShare();
    logCore.writeInfo("Shares list initlalized");
} else {
    fs.writeFileSync("./_server_data/shares.json", "{}", { encoding: "utf-8" });
    logCore.writeLog("Shares list created");
    shareCoreInstance = new shareCore([], storagePath);
}
//banip初始化
if (fs.existsSync("./_server_data/banip.json")) {
    logCore.writeLog("Loading banip list...");
    banip = new Set(fs.readJsonSync("./_server_data/banip.json"));
    logCore.writeInfo("Banip list initlalized");
} else {
    fs.writeFileSync("./_server_data/banip.json", "[]", { encoding: "utf-8" });
    logCore.writeLog("Empty banip list created");
    banip = new Set();
}
//公开文件分享初始化
fs.ensureDirSync(`./_publicFiles/`);
(async function () {
    publicFileList = await initPublicFiles();
})();
//命令系统
const commandListObj = fs.readJsonSync("./assets/commands.json");
const commandFunctionInterface = {
    locked_commandRestart: () => {
        initCommandSystem(commandListObj, commandFunctionInterface, true);
    },
    cmdAccount: (args) => {
        switch (args[1]) {
            case "list":
                let tempString = "所有注册的账户:";
                for (const iterator of regUsers.keys()) {
                    tempString = tempString.concat(iterator, " ");
                }
                console.log(tempString);
                break;
            case "create":
                if (args.length !== 5) {
                    if (args.length < 5) {
                        const argList = ["email", "password", "account"];
                        logRed(`语法错误:参数"${argList[4 - (args.length)]}"不应为undefined`);
                    } else {//大于5
                        logRed(`语法错误:传入参数数量异常`);
                    }
                    return
                }
                if (regUsers.has(args[2])) {//防止重复用户名
                    logYellow("创建失败:已存在该用户名");
                    return
                }
                regUsers.set(args[2], {
                    password: args[3],
                    permission: "user",
                    storage: serverConfig.defaultNewUserStorage,
                    nickName: args[2],
                    email: args[4],
                    uaDetectEnable: false,
                    ua: "",
                    enableShare: true,
                    onUserAgentDetectFailed: "ua",
                    enabled: true
                });
                fs.ensureDir(`${storagePath}${args[2]}/`).then(() => {
                    computeSpace(`${storagePath}${args[2]}/`, args[2], true);
                    logGreen(`成功创建账户:${args[2]}`);
                });
                break
            case "remove":
                if (args[2] === undefined) {
                    logRed('语法错误:参数"account"不应为undefined');
                    return
                };
                if (args[3] !== undefined && !isBooleanStr(args[3])) {
                    logRed(`语法错误:参数"removeStorage"类型必须为Boolean或置空 接收到"${args[3]}"`);
                    return
                }
                if (args.length > 4) {
                    logRed(`语法错误:多余的参数"${args[4]}"`);
                    return
                }
                if (!regUsers.has(args[2])) {
                    logYellow(`移除失败:找不到账户"${args[2]}"`);
                    return
                };
                userTokens.delete(args[2]);
                if (deleteAccount(args[2], args[3] === "true")) {
                    logGreen(`删除账户"${args[2]}"成功`);
                } else {
                    logYellow(`删除账户"${args[2]}"失败\n请检查目标账户是否存在,也可能是删除其存储文件时发生了异常`);
                }
                break
            case "getConfig":
                if (args.length > 3) {
                    logRed(`语法错误:多余的参数"${args[3]}"`);
                    return
                };
                if (args[2] === undefined) {
                    logRed(`语法错误:参数"account"不得为undefined`);
                    return
                }
                const userConfig = regUsers.get(args[2]);
                if (userConfig === undefined) {
                    logYellow(`找不到账户:${args[2]}`);
                    return
                }
                console.log(`账户"${args[2]}"的配置:`);
                for (const iterator of Object.keys(userConfig)) {
                    logGreen(`${iterator}:${userConfig[iterator]}`);
                };
                break
            case "setConfig":
                if (args.length > 5) {
                    logRed(`语法错误:多余的参数"${args[5]}"`);
                    return
                }
                if (args[2] === undefined) {
                    logRed(`语法错误:参数"account"不得为undefined`);
                    return
                }
                if (args[3] === undefined) {
                    logRed(`语法错误:参数"config"不得为undefined`);
                    return
                }
                if (args[4] === undefined) {
                    logRed(`语法错误:参数"value"不得为undefined`);
                    return
                }
                if (!userConfigsList.has(args[3])) {
                    logYellow(`找不到该配置项:${args[3]}`);
                    return
                }
                const userDataTemp = regUsers.get(args[2]);
                if (userDataTemp === undefined) {
                    logYellow(`找不到该用户数据:${args[2]}`);
                    return
                }
                switch (args[3]) {
                    case "storage":
                        if (parseInt(args[4]) === NaN) {
                            logYellow('配置项"storage"只接受类型:Number');
                            return
                        };
                        userDataTemp[args[3]] = parseInt(args[4]);
                        break
                    case "uaDetectEnable":
                        if (!isBooleanStr(args[4])) {
                            logYellow('配置项"uaDetectEnable"只接受类型:Boolean');
                            return
                        }
                        userDataTemp[args[3]] = (args[4] === "true");
                        true
                        break
                    case "enabled":
                        if (!isBooleanStr(args[4])) {
                            logYellow('配置项"enabled"只接受类型:Boolean');
                            return
                        }
                        userDataTemp[args[3]] = (args[4] === "true");
                        break
                    case 'enableShare':
                        if (!isBooleanStr(args[4])) {
                            logYellow('配置项"enableShare"只接受类型:Boolean');
                            return
                        }
                        userDataTemp[args[3]] = (args[4] === "true");
                        break
                    default:
                        userDataTemp[args[3]] = args[4];
                        break
                }
                logGreen(`已将账户"${args[2]}"的配置"${args[3]}"数值更改为:${args[4]}`);
                break
            case "logout":
                if (args.length > 3) {
                    logRed(`语法错误:多余的参数"${args[3]}"`);
                    return
                }
                if (args[2] === undefined) {
                    logRed(`语法错误:参数"account"类型必须为String 接收到undefined`);
                    return
                }
                setUserToken(args[2]);
                logGreen(`已重置账户"${args[2]}"的登录Token`);
                break
            case "deleteDisabledAccount":
                deleteDisabledAccount().then((value) => {
                    logGreen(`执行完成 删除了${value}个账户`);
                });
                break
            default:
                logRed(`未知操作:${args[1]}`);
                break;
        }
    },
    cmdConfig: (args) => {
        if (args[1] === "get") {
            if (args.length > 2) {
                logRed(`语法错误:多余的参数"${args[2]}"`);
                return
            };
            console.log("服务器配置信息:");
            for (const iterator of Object.keys(serverConfig)) {
                logGreen(`${iterator}:${typeof serverConfig[iterator] === "object" ? returnMailerStr() : serverConfig[iterator]}`);
            };
        } else if (args[1] === "set") {
            if (!configKeys.has(args[2])) {
                if (args[2] === undefined) {
                    logRed('语法错误:参数"config"不得为undefined');
                    return
                }
                logYellow(`服务器无该配置项:${args[2]}`);
                return
            };
            if (args[3] === undefined && args[2] !== "mailerConfig") {
                logRed('语法错误:参数"value"不得为undefined');
                return
            }
            const typeBoolean = ["debug", "enableHTTPS", "enabledWebBackground", "enableShare", "enableRegister", "enabledStreamMedia", "enableNickName", "randomBackgroundPort",
                "backgroundLoginGUI", "backgroundRandomKey", "changeNicknameExamine", "onlyLocalhostBackground", "registerVerify", "enableBanipTips", "autoProvisionalBanip", "limitRegisterEveryday", "deletedFilesBackup", "enableResetPassword"];
            const typeNumber = ["maxLogArrayLength", "portForHTTPS", "backgroundPort", "autoSaveTimer", "provisionalBanipTime", "defaultNewUserStorage", "maxEverydayRigister", "loginFailedLimitTime"];
            if (typeBoolean.includes(args[2])) {//是需要类型为Boolean的
                if (isBooleanStr(args[3])) {
                    serverConfig[args[2]] = (args[3] === "true");
                    logGreen(`服务器配置"${args[2]}"已更改为${args[3]}`);
                    if (args[2] === "autoProvisionalBanip") {//更改配置
                        provisionalBanip.enable = (args[3] === "true");
                    }
                    process.send({ signal: "CONFIG_UPDATE", data: serverConfig });
                } else {
                    logRed(`配置项"${args[2]}"的值只接受类型Boolean`);
                }
            } else if (typeNumber.includes(args[2])) {//数字
                const parsedNum = parseInt(args[3]);
                if (isNaN(parsedNum)) {
                    logRed(`配置项"${args[2]}"的值只接受类型Number`);
                } else {
                    serverConfig[args[2]] = parsedNum;
                    logGreen(`服务器配置"${args[2]}"已更改为${args[3]}`);
                    process.send({ signal: "CONFIG_UPDATE", data: serverConfig });
                }
            } else if (args[2] === "mailerConfig") {
                if (args.length !== 7) {
                    logYellow("语法错误:邮箱配置语法如下\nconfig set mailerConfig <发件邮箱:string> <授权码:string> <域名:string> <端口:number>");
                    logYellow("授权码请前往邮箱网站申请 域名及端口请在邮箱网站文档中查看或自行搜索");
                    return
                };
                if (isNaN(parseInt(args[6]))) {
                    logRed(`邮箱端口数据类型只能为Number`);
                    return
                };
                serverConfig.mailerConfig.email = args[3];
                serverConfig.mailerConfig.pass = args[4];
                serverConfig.mailerConfig.host = args[5];
                serverConfig.mailerConfig.port = parseInt(args[6]);
                logGreen("邮箱配置更改已完成");
                process.send({ signal: "CONFIG_UPDATE", data: serverConfig });
            } else {
                serverConfig[args[2]] = args[3];
                logGreen(`服务器配置"${args[2]}"已更改为:${args[3]}`);
                process.send({ signal: "CONFIG_UPDATE", data: serverConfig });
            }
        } else {
            logRed(`异常操作:${args[1]}`);
        }
    },
    cmd_statistics: () => {
        logGreen(`文件下载:${statistics.download}`);
        logGreen(`文件上传:${statistics.upload}`);
        logGreen(`登录次数:${statistics.loginCount}`);
        logGreen(`流媒体播放数:${statistics.streamMedia}`);
        logGreen(`新增文件分享:${statistics.newShare}`);
        logGreen(`新注册用户:${statistics.register}`);
    },
    async cmd_share(args) {
        switch (args[1]) {
            case "list":
                if (args[2] !== undefined) {
                    if (!regUsers.has(args[2])) {
                        logYellow(`未找到用户:${args[2]}`);
                        return
                    }
                    const userList = shareCoreInstance.getAllShared(args[2]);
                    console.log(`用户"${args[2]}"的文件分享:`);
                    for (const iterator of Object.keys(userList)) {
                        logGreen(`文件名:${userList[iterator].file} id:${userList[iterator].id}`);
                    }
                    return
                }
                const list = shareCoreInstance.getAllUserShares();
                console.log("当前所有用户的分享:");
                for (const iterator of Object.keys(list)) {
                    logGreen(`分享者用户名:${list[iterator].account} 文件名:${list[iterator].file} id:${iterator}`);
                }
                break
            case "removeAccount":
                if (args[2] === undefined) {
                    logRed('语法错误:参数"account"不得为undefined');
                    return
                }
                if (!regUsers.has(args[2])) {
                    logYellow(`找不到账户:${args[2]}`);
                    return
                }
                shareCoreInstance.removeAccountAllShare(args[2]);
                logGreen(`已移除账户"${args[2]}"的所有分享`);
                break
            case "removeId":
                if (args[2] === undefined) {
                    logRed('语法错误:参数"id"不得为undefined');
                    return
                }
                const share = await shareCoreInstance.getShareInfo(args[2]);
                if (share === null) {
                    logYellow("未找到分享");
                    return
                }
                shareCoreInstance.removeShare(share.id, share.sharer);
                logGreen("移除完成");
                break
            default:
                logRed(`未知操作:${args[1]}`);
        }
    },
    cmd_nick(args) {
        switch (args[1]) {
            case "list":
                logGreen("昵称审核列表:");
                const nickList = nickNameExamineInstance.nickList;
                for (const iterator of Object.keys(nickList)) {
                    console.log(`用户名:${iterator} 昵称:${nickList[iterator].oldName} --> ${nickList[iterator].newName}`);
                }
                break;
            case "agree":
                if (args[2] === undefined) {
                    logRed(`语法错误:参数"account"不得为undefined`);
                    return
                }
                if (!nickNameExamineInstance.hasWaitingfExamine(args[2])) {
                    logYellow(`账户"${args[2]}"无更改昵称请求`);
                    return
                }
                const nameObj = nickNameExamineInstance.nickList[args[2]];
                if (nameObj === undefined) {
                    logRed(`错误:找不到账户"${args[2]}"`);
                    return
                }
                const data = regUsers.get(args[2]);
                data.nickName = nameObj.newName;
                nickNameExamineInstance.removeExamine(args[2]);
                logGreen(`已通过账户"${args[2]}"的昵称更改请求`);
                break
            case "reject":
                if (args[2] === undefined) {
                    logRed(`语法错误:参数"account"不得为undefined`);
                    return
                }
                logGreen(nickNameExamineInstance.removeExamine(args[2]) ? `已拒绝账户"${args[2]}"的昵称更改请求` : `拒绝账户"${args[2]}"请求失败:该账户无昵称更改请求?`)
                break
            default:
                logRed(`未知操作:${args[1]}`)
                break;
        }
    },
    rpfl: async () => {
        publicFileList = await initPublicFiles();
        logGreen("已执行");
    },
    cmd_banip: (args) => {
        switch (args[1]) {
            case "list":
                logGreen(`下为所有被封禁的IP 共${banip.size}个`);
                banip.forEach((value) => {
                    console.log(value);
                });
                break
            case "add":
                if (args[2] === undefined) {
                    logRed('语法错误:参数"ip"不得为undefined');
                    return
                }
                banip.add(args[2]);
                logGreen(`IP地址"${args[2]}"已封禁`);
                break
            case "remove":
                if (args[2] === undefined) {
                    logRed('语法错误:参数"ip"不得为undefined');
                    return
                }
                banip.delete(args[2]) ? logGreen(`IP地址"${args[2]}"已解封`) : logYellow(`IP地址"${args[2]}"不在封禁列表中`);
                break
            default:
                logRed(`未知操作:${args[1]}`);
        }
    },
    test: (args) => {
        shareCoreInstance.hasShare(args[1]);
    }
}
function initCommandSystem(locked) {
    commandSystemInstance = new CS(commandListObj, commandFunctionInterface, locked);
}
function returnMailerStr() {
    let mailerStr = "{\n";
    for (const iterator of Object.keys(serverConfig.mailerConfig)) {
        mailerStr = mailerStr.concat("    ", iterator, ":", serverConfig.mailerConfig[iterator], "\n");
    }
    mailerStr = mailerStr.concat("}")
    return mailerStr
}
initCommandSystem(false);

function onNewRequest(request, respone) {
    if (banip.has(getRequestIpAddress(request))) {
        if (serverConfig.enableBanipTips) {
            respone.writeHead(403, "", { "Content-Type": "text/html;charset=utf-8" }).end(serverConfig.banipTipsText || "IP banned");
            logCore.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
            return
        }
        logCore.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
        request.destroy();
        respone.destroy();
        return
    }
    if (provisionalBanip.isBanned(getRequestIpAddress(request))) {
        if (serverConfig.enableBanipTips) {
            respone.writeHead(403, "", { "Content-Type": "text/html;charset=utf-8" }).end(serverConfig.banipTipsText || "IP banned");
            logCore.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
            return
        }
        logCore.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
        request.destroy();
        respone.destroy();
        return
    }
    if (request.method === "GET") {
        // console.log(request.url);
        if (request.url === "/") {
            respone.writeHead(301, "Redirect", { location: "/index.myWeb" }).end();
            return
        }
        //get解析
        let urlQuery = url.parse(request.url, true).query;
        if (urlQuery !== null) {
            switch (urlQuery.action) {
                case "login"://登录
                    /* action:login
                    account:账号
                    password:密码 */
                    onUserLogin(urlQuery, respone, request);
                    urlQuery = null;
                    return
                case "download"://下载
                    /* action:download
                    file:文件名*/
                    downloadFile(urlQuery, request, respone)
                    return
                case "stroageSpace"://查询存储空间
                    /* action：stroageSpace */
                    computeSpaceAndRespone(request, respone)
                    return
                case "delete"://删除
                    /* action:delete
                    name:文件名 */
                    deleteDiskFile(request, respone, urlQuery)
                    return
                case "rename":
                    /* action:rename
                    target:源文件名
                    newNane:新文件名 */
                    renameDiskFile(request, respone, urlQuery)
                    return
                case "streamMedia":
                    /* action:streamMedia
                    name:文件名 */
                    streamMedia(urlQuery, request, respone);
                    return
                case "getUserInfomation":
                    /* action:getUserInfomation */
                    responeUserInfo(request, respone);
                    return
                case "changeNickName":
                    /* 
                    newName:新昵称
                     */
                    changeNiceName(urlQuery, request, respone);
                    return
                case "changeEmail":
                    /* 
                    newEmail:新邮箱
                     */
                    changeEmail(urlQuery, request, respone)
                    return
                case "changePassword":
                    /* 
                    newPassword:新密码
                     */
                    changePassword(urlQuery, request, respone);
                    return
                case "setConfig":
                    /* config:配置类型
                    value:值
                     */
                    setUserAccountConfig(urlQuery, request, respone);
                    return
                case "shareFile":
                    /* 
                    name:申请分享的文件名 */
                    shareFile(urlQuery, request, respone);
                    return
                case "hasShareFile":
                    /* 
                    id:文件分享id */
                    hasShareFile(urlQuery, request, respone)
                    return
                case "getShareInfo":
                    /* 
                    file:分享id
                     */
                    getShareInfo(urlQuery, request, respone);
                    return
                case "downlaodShare":
                    /* 
                    id:文件分享id */
                    downloadShare(urlQuery, request, respone);
                    return
                case "getAllSharedFile":
                    getAllSharedFile(urlQuery, request, respone);
                    return
                case "removeShare":
                    /* 
                    id:文件分享id */
                    removeShare(urlQuery, request, respone);
                    return
                case "destroyAccount":
                    destroyAccount(request, respone);
                    return
                case "reg":
                    /* 
                    account:用户名
                    password:密码
                    email:邮箱 
                    verify:验证码(按需)*/
                    registerAccount(urlQuery, request, respone);
                    return
                case "getHttpsPort":
                    getHttpsPort(respone);
                    return
                case "getPublicFileList":
                    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify(publicFileList));
                    return
                case "downloadPublieFile":
                    /* name:文件名 */
                    downloadPublicFile(urlQuery, request, respone);
                    return
                case "publicStreamMedia":
                    /* name:文件名 */
                    streamMediaForPublicFlies(urlQuery, request, respone);
                    return
                case "dumpLog_userDownload":
                    userDownloadLog(request, respone);
                    return
                case "rstPwd_account":
                    /* 
                    account:账户
                    email:邮箱
                     */
                    resetPassword_sendCode(urlQuery, request, respone);
                    return
                case "rstPwd_verify":
                    /* code:验证码 */
                    resetPassword_verifyCode(urlQuery, request, respone);
                    return
                case "rstPwd_newPwd":
                    /* pwd:新密码 */
                    resetPassword_newPassword(urlQuery, request, respone);
                    return
                case "sendRegisterVerify":
                    /*account 账户
                    email:邮箱 
                     */
                    sendRegisterVerify(urlQuery, request, respone)
                    return
            }
        }
        let urlName = request.url.replace("/", "");
        switch (urlName) {
            case "favicon.ico":
                respone.writeHead(200).end(ico);
                break
            case "index.myWeb":
                authenticationFunction(request) ? respone.writeHead(200).end(authenticationSucceed) : respone.writeHead(200).end(loginPage);
                break;
            case "login.webStyle":
                respone.writeHead(200).end(loginCss);
                break
            case "main.disk":
                userDiskHome(request, respone);
                break
            case "main.disk.j":
                respone.writeHead(200).end(homeScript);
                break
            case "main.disk.cs":
                respone.writeHead(200).end(mainDiskCss);
                break
            case "userCenter.js":
                respone.writeHead(200).end(userCenterScript);
                break
            case "userCenter.cssf":
                respone.writeHead(200).end(userCenterStyle);
                break
            case "about.h":
                respone.writeHead(200).end(aboutHtml);
                break
            case "mediaPlayer.subWindow":
                respone.writeHead(200).end(mediaSubWindow);
                break
            case "userCenter.settings":
                // 防止未登录进入
                authenticationFunction(request) ? respone.writeHead(200).end(userCenter) : respone.writeHead(301, "Redirect", { location: "/index.myWeb" }).end();
                break
            case "bitmap_html_switch_true.bitmap":
                respone.writeHead(200).end(switchBitmapTrue);
                break
            case "bitmap_html_switch_false.bitmap":
                respone.writeHead(200).end(switchBitmapFasle)
                break
            case "shareInfo.win":
                respone.writeHead(200).end(shareInfoHtml);
                break
            case "destroyAccount.thxWel":
                respone.writeHead(200).end(destroyAccountHtml);
                break
            case "Hello.welcomeRegister":
                if (!serverConfig.enableRegister) {
                    respone.writeHead(200).end(registerAccountDisabledHtml);
                    return
                }
                if (authenticationFunction(request)) {
                    respone.writeHead(200).end(authenticationSucceed);
                    logCore.writeVerbose(`将已登录账户重定向出注册页面`);
                    return
                }
                respone.writeHead(200).end(serverConfig.registerVerify ? regAccountHasVerifyHtml : regAccountHtml);
                break
            case "public.shareList":
                respone.writeHead(200).end(publicFileListHtml);
                break
            case "xmPlayer.ft2":
                respone.writeHead(200).end(fastTracker_playerHtml);
                break
            case "ft2_main.js":
                respone.writeHead(200).end(fastTracker_playerMainScript);
                break
            case "ft2_player.js":
                respone.writeHead(200).end(fastTracker_playerScript);
                break
            case "ft2_utils.js":
                respone.writeHead(200).end(fastTracker_playerUtilScript);
                break
            case "password.rst":
                respone.writeHead(200).end(serverConfig.enableResetPassword ? resetPasswordHtml : disabledResetPasswordHtml);
                break
            case "spc700.player":
                respone.writeHead(200).end(spcPlayerHtml);
                break
            case "spc700Player.js":
                respone.writeHead(200).end(spcPlayerJavaScript);
                break
            case "spc.wasm":
                respone.writeHead(200, "", { "Content-Type": "application/wasm" }).end(spcPlayerWasm);
                break
            case "audioMetadata.reader":
                respone.writeHead(200).end(webAudioMetadataReader);
                break
            case "openSource.list":
                respone.writeHead(200).end(openSourceHtml);
                break
            default:
                respone.writeHead(404).end();
                logCore.writeWarn(`找不到资源:${urlName}`);
                break
        }
    } else if (request.method === "POST") {
        if (request.headers["content-type"] === "application/json") {
            let postData = '';
            request.on("data", (data) => {
                postData += data;
                if (postData.length >= 16384) {//正常情况不会出现这么大的数据
                    request.destroy();
                    respone.destroy();
                    postData = null;
                    logCore.writeWarn(`POST请求接收数据大小超过阈值(请求文件上传)\nIP:${getRequestIpAddress(request)}`);
                    provisionalBanip.addBan(getRequestIpAddress(request));
                    return
                }
            })
            request.on("end", () => {
                // 鉴权
                if (!authenticationFunction(request)) {
                    respone.writeHead(403).end("Authentication failed");
                    logCore.writeWarn(`POST 上传文件请求JSON鉴权失败,cookie:${request.headers.cookie}`);
                    postData = null;
                    return
                }
                let userCookie = cookie.parse(request.headers.cookie);
                let postObj;
                try {
                    postObj = JSON.parse(postData);
                } catch (error) {
                    logCore.writeError(`序列化JSON失败\nCookie:${request.headers.cookie}\nUA:${request.headers["user-agent"]}`);
                    provisionalBanip.addCount(getRequestIpAddress(request));
                    respone.writeHead(501).end("Parse json failed");
                    return
                }
                /*
                    size:文件大小 name:文件名
                 */
                /* 
                uploadUserToken key:用户token value:文件名
                */
                postData = null;
                //判断json是否合规
                if (postObj.name == undefined || typeof postObj.size !== "number") {
                    respone.writeHead(403).end("Invalid parems");
                    logCore.writeWarn(`POST数据不合规:${postData}`);
                    provisionalBanip.addCount(getRequestIpAddress(request));
                    return
                }
                //合规性检测
                if ((postObj.name.toString()).length > 100 || (postObj.name.toString()).length <= 0) {
                    //文件名长度
                    respone.writeHead(403).end("Too long of short file name");
                    logCore.writeLog(`文件名长度不合规.用户名:${userCookie.account},长度:${(postObj.name.toString()).length}`);
                    return
                }
                if (fileNameFilter.test(postObj.name.toString())) {
                    respone.writeHead(403).end("Not allowed name");
                    logCore.writeLog(`拦截文件名含禁止字符的文件上传.用户名:${userCookie.account}.文件名:${postObj.name.toString()}`);
                    return
                }
                if (detectXssString(postObj.name.toString())) {
                    logCore.writeWarn(`用户"${userCookie.account}"上传文件名触发XSS检测 IP:${getRequestIpAddress(request)}`);
                    respone.writeHead(403).end("Not allowed name");
                    provisionalBanip.addCount(getRequestIpAddress(request));
                    return
                }
                /*Only For Windows */
                if (process.platform === "win32") {
                    if (windowsFilterName.has(postObj.name.slice(0, postObj.name.indexOf(".") === -1 ? postObj.name.length : postObj.name.indexOf(".")).toUpperCase())) {
                        logCore.writeWarn(`用户"${userCookie.account}"尝试上传文件名为Windows保留名的文件:${postObj.name}`);
                        respone.writeHead(403).end("Not allowed name");
                        return
                    }
                }
                if (uploadingUserToken.has(userCookie.token)) {
                    uploadingUserToken.get(userCookie.token).pipe.destroy();//释放文件以便删除
                    fs.removeSync(`${storagePath}${userCookie.account}/${(uploadingUserToken.get(userCookie.token)).name}`);
                    logCore.writeVerbose(`文件:${uploadingUserToken.get(userCookie.token).name}由于上传失败已被移除.所属用户:${userCookie.account}`);
                    uploadingUserToken.delete(userCookie.token);
                }
                //存储空间和文件名检测 可以精简
                computeSpace(`${storagePath}${userCookie.account}/`, userCookie.account).then(value => {
                    let repeatFilter = value.files.some(filter => {
                        if (filter.name === postObj.name.toString()) {
                            return true
                        }
                    })
                    if ((value.total - value.used) < postObj.size || repeatFilter) {
                        respone.writeHead(401).end("Low space or file name repeat");
                        if (repeatFilter) {
                            logCore.writeWarn(`已阻止用户${userCookie.account}上传重名文件:${postObj.name}`);
                        } else {
                            logCore.writeWarn(`已阻止用户"${userCookie.account}"尝试在剩余${value.total - value.used < 0 ? "0" : value.total - value.used}字节的空间中上传前端报告为${postObj.size}字节的文件:${postObj.name}`);
                            provisionalBanip.addCount(getRequestIpAddress(request))
                        }
                        uploadingUserToken.get(userCookie.token).pipe.destroy();//释放文件以便删除
                        fs.removeSync(`${storagePath}${userCookie.account}/${(uploadingUserToken.get(userCookie.token)).name}`);
                        uploadingUserToken.delete(userCookie.token);
                    } else {
                        try {//writeStream异常
                            uploadingUserToken.set(userCookie.token, { name: (postObj.name).toString(), pipe: fs.createWriteStream(`${storagePath}${userCookie.account}/${(postObj.name.toString())}`, { encoding: "hex" }) });
                        } catch (err) {
                            logCore.writeError(`创建上传文件流时异常\n路径:${storagePath}${userCookie.account}/${(postObj.name.toString())}\n用户名:${userCookie.account}\n详情:${err.stack}`);
                            respone.writeHead(501).end("Create stream error");
                            return
                        }
                        respone.writeHead(201).end("Ready");
                        logCore.writeVerbose(`准备接收来自用户"${userCookie.account}"上传的文件:${postObj.name}\n文件大小:${postObj.size}字节`);
                    }
                })

            })
        } else if (request.headers["content-type"] === "application/x-www-form-urlencoded") {
            if (!authenticationFunction(request)) {
                respone.writeHead(403).end("Authentication failed");
                logCore.writeWarn(`上传文件数据进行鉴权失败\nCookie:${request.headers.cookie}\nUA:${request.headers["user-agent"]}`);
                return
            }
            const uploadingCookie = cookie.parse(request.headers.cookie);
            //获取剩余存储空间 允许6mb容错
            let sizeDetectOnUploading = (freeSpace.get(uploadingCookie.account).free) + (3 * 1024 * 1024);
            //防止某些闲的蛋疼拿到cookie直接上传搞炸服务端
            if (!uploadingUserToken.has(uploadingCookie.token)) {
                logCore.writeWarn(`用户"${uploadingCookie.account}"在未发起上传文件请求时进行数据上传操作`);
                respone.writeHead(403).end("You must request create write file stream before upload data");
                provisionalBanip.addCount(getRequestIpAddress(request));
                return
            }
            let pipe = uploadingUserToken.get(uploadingCookie.token).pipe;
            let writedSize = 0;
            request.on("data", (data) => {
                writedSize += data.byteLength;
                if (writedSize > sizeDetectOnUploading) {//写入大小超过分配空间+3mb直接中断连接
                    respone.writeHead(403).end("Connection close");
                    request.destroy();
                    pipe.destroy(new Error());
                    provisionalBanip.addCount(getRequestIpAddress(request));
                    logCore.writeWarn(`用户"${uploadingCookie.account}"上传文件大小超出可用存储空间.\nIP:${getRequestIpAddress(request)}\n剩余存储空间:${freeSpace.get(uploadingCookie.account).free}\n已写入存储空间:${writedSize}`);
                    return
                }
                pipe.write(data);
            })
            pipe.on("error", () => {
                fs.remove(pipe.path);
            });
            request.on("end", () => {
                pipe.end();
                logCore.writeVerbose(`用户"${uploadingCookie.account}"的文件上传完成,位于服务器存储盘${pipe.path}`);
                uploadingUserToken.delete(uploadingCookie.token);
                statistics.upload++;
                respone.writeHead(200).end();
                computeSpace(`${storagePath}${uploadingCookie.account}/`, uploadingCookie.account, true);
            })
        } else {
            logCore.writeWarn(`意料之外的POST请求头类型:${request.headers["content-type"]}`);
            provisionalBanip.addCount(getRequestIpAddress(request));
            respone.writeHead(500).end();
        }
    } else {
        logCore.writeWarn(`意料之外的HTTP方法:${request.method}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(500).end();
    }
}
const server = http.createServer(onNewRequest).on("connection", socket => {
    socket.setTimeout(20000);//防止关服一直关不掉
})
if (serverConfig.enableHTTPS) {
    try {
        httpsServer = https.createServer({ key: fs.readFileSync("./assets/https/server.key"), cert: fs.readFileSync("./assets/https/server.crt") }, onNewRequest).on("connection", socket => {
            socket.setTimeout(20000);
        })
        httpsServer.listen(parseInt(serverConfig.portForHTTPS) || 443, "0.0.0.0", () => {//不用443否则浏览器默认用https报证书错误比没https更吓人 同时防止NaN(改用默认443)
            logCore.writeLog(`Disk server listening port:${parseInt(serverConfig.portForHTTPS) || "443"}(For HTTPS)`);
            httpsWorking = true;
        });
    } catch (error) {
        httpsWorking = false;
        if (error.message.toString().includes("no such file or directory")) {
            logCore.writeError("Can not find HTTPS cert files.HTTPS server start failed");
        } else {
            logCore.writeError(`Failed to starting HTTPS server:${error.stack}`);
        }
    }
} else { httpsWorking = false };
server.listen(80, "0.0.0.0", () => {
    logCore.writeLog("Disk server listening port:80(For HTTP)");
    logCore.writeInfo("Server started");
    console.log("------------------------------------RUNNING LOGS------------------------------------");
});
//网络请求处理
function onUserLogin(queryObj, responeObj, request) {
    // 判断账号密码
    let warnUaSetting = false;
    const userData = regUsers.get(queryObj.account);
    if (userData === undefined || !userData.enabled) {//账号错误或封禁||注销
        logCore.writeVerbose(`IP:${getRequestIpAddress(request)}尝试登录不存在被停用的账户:${queryObj.account}`);
        responeObj.writeHead(200).end("FAILED");
        return
    }
    //ip是否被限制该账户登录
    if (!loginFailedLimit.loginable(queryObj.account, getRequestIpAddress(request))) {
        responeObj.writeHead(200).end("LIMIT");
        logCore.writeLog(`账户"${queryObj.account}"触发登录限制 IP:${getRequestIpAddress(request)}`);
        return
    }
    if (regUsers.has(queryObj.account) && userData.password.toString() === queryObj.password.toString()) {
        //登录成功
        if (userData.uaDetectEnable) {//是否开启检测
            if (!(userData.ua.toString() === "")) {//如果开启校验但未设置ua
                if (!(request.headers['user-agent'] === userData.ua)) {//一切正常 进行检测
                    logCore.writeLog(`账户"${queryObj.account}"登录时UA检测不通过\n登录者的UA:${request.headers['user-agent']}\n验证所需的UA:${userData.ua}`);
                    logCore.writeAccountLog(queryObj.account, `登录时UA检测不通过\n登录者的UA:${request.headers['user-agent']}\nIP:${getRequestIpAddress(request)}`);
                    userData.onUserAgentDetectFailed === "password" ? responeObj.writeHead(200).end("FAILED") : responeObj.writeHead(200).end("UA DETECT FAILED");
                    return
                }
            } else {//发现空检测ua 不进行检测并提醒
                warnUaSetting = true;
            }
        }
        //移除该ip的登录失败记录
        loginFailedLimit.remove(queryObj.account, getRequestIpAddress(request));
        //判断登录有效期
        if (queryObj.remembar === "true") {//免登录
            logCore.writeVerbose(`用户"${queryObj.account}"登录成功\n有效期:30日\nIP:${getRequestIpAddress(request)}\nUA:${request.headers['user-agent'] || "未知"}`);
            logCore.writeAccountLog(queryObj.account, `账户登录成功\n有效期:30日\nIP:${getRequestIpAddress(request)}\nUA:${request.headers['user-agent'] || "未知"}`);
            responeObj.setHeader("Set-Cookie", [`token=${setUserToken(queryObj.account, true)};Expires=${getCookieTime()};`, `account=${queryObj.account};Expires=${getCookieTime()};`])
        } else {
            logCore.writeVerbose(`用户"${queryObj.account}"登录成功\n有效期:会话\nIP:${getRequestIpAddress(request)}\nUA:${request.headers['user-agent'] || "未知"}`);
            logCore.writeAccountLog(queryObj.account, `账户登录成功\n有效期:会话\nIP:${getRequestIpAddress(request)}\nUA:${request.headers['user-agent'] || "未知"}`);
            responeObj.setHeader("Set-Cookie", [`token=${setUserToken(queryObj.account, false)}`, `account=${queryObj.account}`])
        }
        statistics.loginCount++;
        responeObj.writeHead(200).end(warnUaSetting ? "LOGIN-UA-WARN" : "LOGIN");
        return
    }
    //登录失败
    logCore.writeLog(`用户"${queryObj.account}"登录时密码错误.输入的密码:${queryObj.password}`);
    logCore.writeAccountLog(queryObj.account, `登录时密码错误.输入的密码:${queryObj.password}`);
    loginFailedLimit.addFailedCount(queryObj.account, getRequestIpAddress(request));
    responeObj.writeHead(200).end("FAILED");
    return
}
function getCookieTime() {
    const newDate = new Date();
    newDate.setTime(newDate.getTime() + (30 * 24 * 60 * 60 * 1000));
    return newDate.toGMTString()
}
function setUserToken(account, expireMonth = false) {
    const token = RT.number_en(32);//生成
    userTokens.set(account, { token: token, expire: expireMonth ? new Date().getTime() + 2592000000 : new Date().getTime() + 86400000 });
    return token
}
/**
 * @description 返回请求源的IP地址
 * @param request {NodejsHttpRequest} Nodejs网络请求
 * @return {String} IP地址
 */
function getRequestIpAddress(request) {
    return ((request.headers['x-forwarded-for'] || '').split(',').pop().trim() || request.connection?.remoteAddress || request.socket?.remoteAddress || request.connection?.socket?.remoteAddress) || "获取失败";
}
//个人存储页面
async function userDiskHome(request, respone) {
    if (authenticationFunction(request)) {
        respone.writeHead(200).end(diskHtml);
        return
    }
    logCore.writeLog(`用户进入存储主页鉴权失败.Cookie:${request.headers.cookie}`);
    respone.writeHead(200).end(authenticationFailed);
}
async function downloadFile(urlQuery, request, respone) {
    //判断登录态
    if (!authenticationFunction(request)) {
        logCore.writeWarn(`申请下载个人文件时鉴权失败.\n文件名:${urlQuery.file}\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(403).end("Authentication failed");
        return
    }
    //cookie2object
    const parsedRequestCookie = cookie.parse(request.headers.cookie || "");
    if (urlQuery.file === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${parsedRequestCookie.account}"下载个人文件时传入无效参数:file\nIP:${getRequestIpAddress(request)}`);
        return
    }
    try {
        if (!fs.existsSync(`${storagePath}${parsedRequestCookie.account}/${urlQuery.file}`)) {
            logCore.writeWarn(`未在用户"${parsedRequestCookie.account}"的存储空间中找到其需要下载的文件:${urlQuery.file}\n检测目标路径:${path.resolve(`${storagePath}${parsedRequestCookie.account}/${urlQuery.file}`)}`);
            respone.writeHead(404).end("Not found file in your's disk");
            provisionalBanip.addCount(getRequestIpAddress(request));
            return
        }
    } catch (error) {
        respone.writeHead(500).end("Exists File Error");
        logCore.writeWarn(`下载个人文件:检测文件是否存在时发生异常:${error.stack}\n用户:${parsedRequestCookie.account}\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //防止利用相对路径读取其他文件
    if (path.relative(`${storagePath}${parsedRequestCookie.account}/`, `${storagePath}${parsedRequestCookie.account}/${urlQuery.file}`) !== urlQuery.file) {
        logCore.writeWarn(`用户"${parsedRequestCookie.account}"尝试在下载文件时访问非自身路径\n该用户分配文件路径:${path.resolve(`${storagePath}${parsedRequestCookie.account}/`)}\n尝试访问的路径:${path.resolve(`${storagePath}${parsedRequestCookie.account}/${urlQuery.file}`)}`);
        provisionalBanip.addBan(getRequestIpAddress(request));
        respone.writeHead(418).end("I'm a Teapot");
        return
    }
    statistics.download++;
    logCore.writeVerbose(`用户"${parsedRequestCookie.account}"下载了个人文件:${urlQuery.file}`);
    logCore.writeAccountLog(parsedRequestCookie.account, `下载个人文件:${urlQuery.file}`);
    respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI(urlQuery.file.toString())}"` });
    fs.createReadStream(`${storagePath}${parsedRequestCookie.account}/${urlQuery.file}`).pipe(respone);
}
function authenticationFunction(request) {
    const userCookie = cookie.parse(request.headers?.cookie || "");
    if (!regUsers.get(userCookie.account)?.enabled) {
        return false
    }
    if (!userTokens.has(userCookie.account)) return false
    const data = userTokens.get(userCookie.account);
    return (userCookie.token === data.token && new Date().getTime() < data.expire)
}
async function computeSpaceAndRespone(request, respone) {
    const storageComputeCookie = cookie.parse(request.headers.cookie || "");
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`获取存储信息时鉴权失败.IP:${getRequestIpAddress(request)}`);
        return
    }
    let storageInfo = await computeSpace(`${storagePath}${storageComputeCookie.account}/`, storageComputeCookie.account);
    if (storageInfo === null) {
        respone.writeHead(403).end("Error:not same disk");
        logCore.writeWarn(`计算存储空间时找不到该账户的存储区域:${storageComputeCookie.account}`);
        return
    }
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify(storageInfo));
}
async function renameDiskFile(request, respone, urlQuery) {
    if (urlQuery.target === urlQuery.newName) {//名称相同跳过下面步骤 免得浪费性能
        respone.writeHead(403).end("Same name");
        logCore.writeVerbose(`重命名文件时前后名称相同:${urlQuery.newName}`);
        return
    }
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`重命名文件时鉴权失败.IP:${getRequestIpAddress(request)}`);
        return
    }
    const renameCookie = cookie.parse(request.headers.cookie);
    if (urlQuery.target === undefined || urlQuery.newName === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${renameCookie.account}"重命名文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (urlQuery.target === "" || urlQuery.newName === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${renameCookie.account}"重命名文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (fileNameFilter.test(urlQuery.newName)) {
        respone.writeHead(403).end("Not allowed name");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeVerbose(`重命名文件时含有禁止字符\n原文件名:${urlQuery.target}\n新文件名:${urlQuery.newName}`);
        return
    }
    if (detectXssString(urlQuery.newName)) {
        respone.writeHead(500).end("Failed");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${renameCookie.account}"重命名文件时触发xss攻击检测\nIP${getRequestIpAddress(request)}`);
        return
    }
    /* Windows保留字 */
    if (process.platform === "win32") {
        if (windowsFilterName.has(urlQuery.newName.slice(0, urlQuery.newName.indexOf(".") === -1 ? urlQuery.newName.length : urlQuery.newName.indexOf(".")).toUpperCase())) {
            logCore.writeWarn(`用户"${renameCookie.account}"尝试将文件重命名为Windows保留文件名:${urlQuery.newName}`);
            respone.writeHead(403).end("Not allowed name");
            return
        }
    }
    if (!fs.existsSync(`${storagePath}${renameCookie.account}/${urlQuery.target.toString()}`)) {
        logCore.writeWarn(`重命名文件时未在用户"${renameCookie.account}"的存储空间内找到文件:${urlQuery.target}`);
        respone.writeHead(404).end("Not found file in your's disk");
        return
    }
    if (path.relative(`${storagePath}${renameCookie.account}/`, `${storagePath}${renameCookie.account}/${urlQuery.target}`) !== urlQuery.target) {
        logCore.writeWarn(`用户"${renameCookie.account}"尝试在下载文件时访问非自身路径\n该用户分配文件路径:${path.resolve(`${storagePath}${renameCookie.account}/`)}\n尝试访问的路径:${path.resolve(`${storagePath}${renameCookie.account}/${urlQuery.target}`)}`);
        provisionalBanip.addBan(getRequestIpAddress(request));
        respone.writeHead(418).end("I'm a Teapot");
        return
    }
    let fileList = await fs.readdir(`${storagePath}${renameCookie.account}/`);
    if (fileList.indexOf(urlQuery.newName) !== -1) {
        /* 正常情况下文件名重复在前端就阻止了 请求送到这不是bug就是f12 */
        logCore.writeWarn(`用户"${renameCookie.account}"在重命名文件时与现有文件名重复:${urlQuery.newName}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(403).end("Repeat file name");
        return
    }
    try {
        await fs.rename(`${storagePath}${renameCookie.account}/${urlQuery.target.toString()}`, `${storagePath}${renameCookie.account}/${urlQuery.newName.toString()}`);
        logCore.writeVerbose(`用户"${renameCookie.account}"将自有文件"${urlQuery.target}"重命名为"${urlQuery.newName}"`);
        logCore.writeAccountLog(renameCookie.account, `重命名个人文件:${urlQuery.target}->${urlQuery.newName}`);
        respone.writeHead(200).end("Renamed")
    } catch (error) {
        logCore.writeError(`重命名文件时发生异常:\n${error.stack}`);
        respone.writeHead(500).end("Rename failed");
    }

}
async function streamMedia(urlQuery, request, respone) {
    if (!serverConfig.enabledStreamMedia) {
        respone.writeHead(400).end("Disabled");
        return
    }
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`播放流媒体时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const mediaCookie = cookie.parse(request.headers.cookie);
    if (urlQuery.name === undefined || urlQuery.name === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${mediaCookie.account}"播放流媒体时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (path.relative(`${storagePath}${mediaCookie.account}/`, `${storagePath}${mediaCookie.account}/${urlQuery.name}`) !== urlQuery.name) {
        logCore.writeWarn(`用户"${mediaCookie.account}"尝试在播放流媒体时访问非自身路径\n该用户分配文件路径:${path.resolve(`${storagePath}${mediaCookie.account}/`)}\n尝试访问的路径:${path.resolve(`${storagePath}${mediaCookie.account}/${urlQuery.name}`)}`);
        provisionalBanip.addBan(getRequestIpAddress(request));
        respone.writeHead(418).end("I'm a Teapot");
        return
    }
    if (await fs.exists(`${storagePath}${mediaCookie.account}/${urlQuery.name}`)) {
        try {
            statistics.streamMedia++;
            fs.createReadStream(`${storagePath}${mediaCookie.account}/${urlQuery.name}`).pipe(respone);
            logCore.writeVerbose(`用户"${mediaCookie.account}"请求播放流媒体文件:${urlQuery.name}成功`);
            logCore.writeAccountLog(mediaCookie.account, `播放媒体文件:${urlQuery.name}`);
            return
        } catch (err) {
            logCore.writeError(`创建文件读取流时失败(流媒体):\n${err.stack}`);
            respone.writeHead(500).end("Create read stream error");
            return
        }
    }
    logCore.writeWarn(`播放流媒体时未在用户"${mediaCookie.account}"的存储空间内找到文件:${urlQuery.name}`);
    respone.writeHead(404).end("Not such file")
}
async function deleteDiskFile(request, respone, parsedUrl) {
    if (!authenticationFunction(request)) {//鉴权
        logCore.writeWarn(`删除用户文件时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(403).end("Authentication failed");
        return
    }
    const deleteCookie = cookie.parse(request.headers.cookie || "");
    if (parsedUrl.name === "" || parsedUrl.name === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${deleteCookie.account}"删除个人文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //防止利用相对路径读取其他文件
    if (path.relative(`${storagePath}${deleteCookie.account}/`, `${storagePath}${deleteCookie.account}/${parsedUrl.name}`) !== parsedUrl.name) {
        logCore.writeWarn(`用户"${deleteCookie.account}"尝试在删除文件时访问非自身路径\n该用户分配文件路径:${path.resolve(`${storagePath}${deleteCookie.account}/`)}\n尝试访问的路径:${path.resolve(`${storagePath}${deleteCookie.account}/${parsedUrl.name}`)}`);
        provisionalBanip.addBan(getRequestIpAddress(request));
        respone.writeHead(418).end("I'm a Teapot");
        return
    }
    if (await fs.exists(`${storagePath}${deleteCookie.account}/${parsedUrl.name}`)) {
        try {
            let nameConfuse = false;
            if (serverConfig.deletedFilesBackup) {//如果开启了被删除文件备份
                await fs.ensureDir(`./_deletedFiles/${deleteCookie.account}/`);
                //防止重名被覆盖
                if (await fs.exists(`./_deletedFiles/${deleteCookie.account}/${parsedUrl.name}`)) nameConfuse = true;
                await fs.move(`${storagePath}${deleteCookie.account}/${parsedUrl.name}`, `./_deletedFiles/${deleteCookie.account}/${parsedUrl.name}${nameConfuse ? RT.number_en(6) : ""}`);
            } else {
                await fs.remove(`${storagePath}${deleteCookie.account}/${parsedUrl.name}`);
            }
            logCore.writeVerbose(`用户"${deleteCookie.account}"删除文件:${parsedUrl.name}`);
            logCore.writeAccountLog(deleteCookie.account, `删除个人文件:${parsedUrl.name}`);
            if (serverConfig.deletedFilesBackup) logCore.writeVerbose("已移动到备份文件夹");
        } catch (e) {
            respone.writeHead(500).end("Delete failed");
            logCore.writeError(`删除文件时发生异常\n用户:${deleteCookie.account}\n文件:${parsedUrl.name}\n详情:${e.stack}`);
            return
        }
        respone.writeHead(200).end("Deleted");
        computeSpace(`${storagePath}${deleteCookie.account}/`, deleteCookie.account, true);
        return
    }
    respone.writeHead(404).end("Not such file")
}

/**
 * @param {String} path
 * @param {String} account
 * @param {boolean} [setSpaceMapping=false]
 * @return {{used:Number,files:Array,total:Number}} 
 */
async function computeSpace(path, account, setSpaceMapping = false) {
    if (!fs.existsSync(path)) {
        return null
    }
    let filesSize = [];
    let usedSize = 0;
    const fileListInUserDisk = await fs.readdir(path);
    for (let filePath of fileListInUserDisk) {
        let sameSize = (await fs.stat(`${path}${filePath}`)).size;
        usedSize += sameSize;
        filesSize.push({
            name: filePath,
            size: sameSize
        })
    }
    //覆盖存储空间map
    if (setSpaceMapping) freeSpace.set(account, { total: ((parseInt(regUsers.get(account).storage)) * 1024 * 1024), free: ((parseInt(regUsers.get(account).storage)) * 1024 * 1024) - usedSize });
    return { used: usedSize, files: filesSize, total: ((parseInt(regUsers.get(account).storage)) * 1024 * 1024) }
}
async function changeNiceName(urlQuery, request, respone) {
    if (!serverConfig.enableNickName) {
        respone.writeHead(200).end("DISABLED");
        return
    }
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`更改用户昵称时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const nickNameCookie = cookie.parse(request.headers.cookie || "");
    if (urlQuery.newName === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${nickNameCookie.account}"重命名文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (urlQuery.newName.toString().length < 1 || urlQuery.newName.toString().length > 16) {
        logCore.writeWarn(`用户"${nickNameCookie.account}"修改昵称长度不合规`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(200).end("FAILED");
        return
    }
    // 防止xss
    if (detectXssString(urlQuery.newName)) {
        logCore.writeWarn(`用户"${nickNameCookie.account}试修改昵称时触发XSS攻击敏感词过滤\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(200).end("FAILED");
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    if (!regUsers.has(nickNameCookie.account)) {
        logCore.writeWarn(`找不到到账户"${nickNameCookie.account}(修改昵称)`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(404).end("Account not found");
        return
    }/* 返回:WAIT:等待审核 CHANGE:已更改 :HAS:已有请求等待审核 FAILED:失败 SW:敏感词*/
    if (nickNameExamineInstance.hasWaitingfExamine(nickNameCookie.account)) {
        respone.writeHead(200).end("HAS");
        return
    }
    const tempUserData = regUsers.get(nickNameCookie.account);
    if (!serverConfig.changeNicknameExamine || regUsers.get(nickNameCookie.account).permission === "admin") {//管理员无需审核或关闭审核
        //检查屏蔽词 管理员忽略
        if (regUsers.get(nickNameCookie.account).permission !== "admin") {
            if (sensitiveWordsFilterInstance.hasSensitiveWords(urlQuery.newName)) {
                respone.writeHead(200).end("SW");
                logCore.writeLog(`用户"${nickNameCookie.account}"提交的昵称更改请求含有敏感词:${urlQuery.newName}`);
                return
            }
        }
        logCore.writeLog(`用户"${nickNameCookie.account}"将昵称由"${tempUserData.nickName}"更改为"${urlQuery.newName}"`);
        logCore.writeAccountLog(nickNameCookie.account, `进行昵称更改:${tempUserData.nickName}->${urlQuery.newName}`);
        tempUserData.nickName = urlQuery.newName;
        regUsers.set(nickNameCookie.account, tempUserData);
        respone.writeHead(200).end("CHANGE");
        return
    }
    nickNameExamineInstance.pushExamine(nickNameCookie.account, regUsers.get(nickNameCookie.account).nickName, urlQuery.newName);
    logCore.writeVerbose(`用户"${nickNameCookie.account}"提交更改昵称申请:${urlQuery.newName}`);
    logCore.writeAccountLog(nickNameCookie.account, `提交昵称更改申请:${tempUserData.nickName}->${urlQuery.newName}`);
    respone.writeHead(200).end("WAIT");
}
async function changeEmail(urlQuery, request, respone) {
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户更改邮箱时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const emailCookie = cookie.parse(request.headers.cookie || "");
    if (urlQuery.newEmail === undefined || urlQuery.newEmail === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${emailCookie.account}"更改邮箱时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (urlQuery.newEmail.toString().length >= 48) {
        respone.writeHead(200).end("TOO LONG EMAIL");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${emailCookie.account}"更改新邮箱过长`);
        return
    }
    //正则验证
    if (!emailReg.test(urlQuery.newEmail.toString())) {
        logCore.writeWarn(`用户"${emailCookie.account}"更改新邮箱正则验证失败:${urlQuery.newEmail}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(200).end("CHECK FAIL");
        return
    }
    if (!regUsers.has(emailCookie.account)) {
        logCore.writeWarn(`无法在用户列表中找到账户"${emailCookie.account}(修改邮箱)`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(404).end("Account not found");
        return
    }
    const tempUserData = regUsers.get(emailCookie.account);
    logCore.writeVerbose(`用户"${emailCookie.account}"将邮箱从"${tempUserData.email}"更改为:${urlQuery.newEmail}`);
    logCore.writeAccountLog(emailCookie.account, `更改邮箱:${tempUserData.email}->${urlQuery.newEmail}`);
    tempUserData.email = urlQuery.newEmail;
    regUsers.set(emailCookie.account, tempUserData);
    respone.writeHead(200).end("CHANGED");
}
async function setUserAccountConfig(urlQuery, request, respone) {
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户更改设置时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const setConfigCookie = cookie.parse(request.headers.cookie || "");
    if (urlQuery.value === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${setConfigCookie.account}"修改账户设置时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const tempUserData = regUsers.get(setConfigCookie.account);
    switch (urlQuery.config) {
        case "uaDetectEnable":
            tempUserData.uaDetectEnable = (urlQuery.value.toString() === "true");//没校验必要 顶多变成false
            regUsers.set(setConfigCookie.account, tempUserData);
            respone.writeHead(200).end("SUCCESS");
            logCore.writeVerbose(`用户"${setConfigCookie.account}"将账户设置"${urlQuery.config}"调整为:${(urlQuery.value.toString() === "true")}`);
            logCore.writeAccountLog(setConfigCookie.account, `将账户配置"${urlQuery.config}"值更改为:${(urlQuery.value.toString() === "true")}`);
            break;
        case "uaDetectString":
            if (urlQuery.value.toString().length > 512) {//长度校验
                respone.writeHead("200").end("Too long UserAgent");
                logCore.writeLog(`用户"${setConfigCookie.account}"尝试设置过长验证用UA`);
                return
            }
            tempUserData.ua = urlQuery.value.toString();
            regUsers.set(setConfigCookie.account, tempUserData);
            logCore.writeVerbose(`用户"${setConfigCookie.account}"将账户设置"${urlQuery.config}"调整为:${urlQuery.value.toString()}`);
            logCore.writeAccountLog(setConfigCookie.account, `将账户配置"${urlQuery.config}"值更改为:${urlQuery.value.toString()}`);
            respone.writeHead(200).end("SUCCESS")
            break
        case "onUAdetectFailed":
            tempUserData.onUserAgentDetectFailed = urlQuery.value.toString() === "passwordError" ? "password" : "ua";
            regUsers.set(setConfigCookie.account, tempUserData);
            respone.writeHead(200).end("SUCCESS");
            logCore.writeVerbose(`用户"${setConfigCookie.account}"将账户设置"${urlQuery.config}"调整为:${urlQuery.value.toString() === "passwordError" ? "password" : "ua"}`);
            logCore.writeAccountLog(setConfigCookie.account, `将账户配置"${urlQuery.config}"值更改为:${urlQuery.value.toString() === "passwordError" ? "password" : "ua"}`);
            break
        default:
            respone.writeHead(403).end("Not same config");
            logCore.writeWarn(`用户"${setConfigCookie.account}"尝试修改不支持的账户设置`);
            provisionalBanip.addCount(getRequestIpAddress(request));
            break;
    }
}
async function changePassword(urlQuery, request, respone) {
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户更改密码时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const passwordCookie = cookie.parse(request.headers.cookie || "");
    if (urlQuery.newPassword === undefined || urlQuery.newPassword === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${passwordCookie.account}"更改密码时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //长度
    if (urlQuery.newPassword.toString().length < 1 || urlQuery.newPassword.toString().length > 64) {
        respone.writeHead(200).end("NON STANDARD");
        logCore.writeWarn(`用户"${passwordCookie.account}设置的新密码不符合长度要求`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    //更改密码数据
    const tempUserData = regUsers.get(passwordCookie.account);
    tempUserData.password = urlQuery.newPassword;
    regUsers.set(passwordCookie.account, tempUserData);
    setUserToken(passwordCookie.account);//重置登录
    logCore.writeVerbose(`用户"${passwordCookie.account}已修改登录密码`);
    logCore.writeAccountLog(passwordCookie.account, "已修改登录密码");
    respone.writeHead(200).end("SUCCESS");
}
//分享文件
async function shareFile(urlQuery, request, respone) {
    if (!serverConfig.enableShare) {//关闭分享功能
        respone.writeHead(405).end("Disabled");
        return
    }
    const shareFileCookie = cookie.parse(request.headers.cookie || "");
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户分享文件时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (!regUsers.get(shareFileCookie.account).enableShare) {
        respone.writeHead(401).end("Account disabled share");
        return
    }
    if (urlQuery.name == undefined || urlQuery.name === "" || urlQuery.expire === undefined || urlQuery.expire === "") {
        respone.writeHead(500).end("Invaild arguments");
        logCore.writeWarn(`用户"${shareFileCookie.account}"分享文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    //检查文件是否存在
    if (!await fs.exists(`${storagePath}${shareFileCookie.account}/${urlQuery.name}`)) {
        respone.writeHead(404).end("File not found");
        logCore.writeWarn(`无法在该用户存储空间内找到其请求分享的文件:${urlQuery.name}\n用户:${shareFileCookie.account}`);
        return
    }
    //屏蔽词
    if (sensitiveWordsFilterInstance.hasSensitiveWords(urlQuery.name)) {
        respone.writeHead(402).end("Sensitive words");
        logCore.writeLog(`用户准备分享的文件名包含屏蔽词:${urlQuery.name}\n用户:${shareFileCookie.account}`);
        return
    }
    //确定是自己的文件(过滤相对路径)
    if (path.relative(`${storagePath}${shareFileCookie.account}/`, `${storagePath}${shareFileCookie.account}/${urlQuery.name}`) !== urlQuery.name) {
        respone.writeHead(418).end("I'm a Teapot");
        provisionalBanip.addBan(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${shareFileCookie.account}"尝试在删除文件时访问非自身路径\n该用户分配文件路径:${path.resolve(`${storagePath}${shareFileCookie.account}/`)}\n尝试访问的路径:${path.resolve(`${storagePath}${shareFileCookie.account}/${urlQuery.name}`)}`);
        return
    }
    const shareCode = shareCoreInstance.addShare(shareFileCookie.account, urlQuery.name, urlQuery.expire);
    if (!shareCode) {//排除null
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ statu: 500, code: "" }));
        return
    }
    statistics.newShare++;
    logCore.writeLog(`用户"${shareFileCookie.account}"分享了文件:${urlQuery.name}\n有效期:${urlQuery.expire}`);
    logCore.writeAccountLog(shareFileCookie.account, `分享文件成功:${urlQuery.name}\n有效期:${urlQuery.expire}`);
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ statu: 200, code: shareCode }));
}
async function hasShareFile(urlQuery, request, respone) {
    if (!serverConfig.enableShare) {//关闭分享功能
        respone.writeHead(200).end("Disabled");
        return
    }
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`查询分享文件时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    respone.writeHead(200).end((shareCoreInstance.hasShare(urlQuery.id)).toString());
}
async function responeUserInfo(request, respone) {
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`获取用户信息时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const responeInfoCookie = cookie.parse(request.headers.cookie || "");
    if (!regUsers.has(responeInfoCookie.account)) {
        logCore.writeWarn(`请求用户信息时无法找到账户:${responeInfoCookie.account}`);
        respone.writeHead(404).end("Account not found");
        return
    }
    const tempUserMapInfo = regUsers.get(responeInfoCookie.account);
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ nickName: tempUserMapInfo.nickName, email: tempUserMapInfo.email, uaDetectEnabled: tempUserMapInfo.uaDetectEnable, ua: tempUserMapInfo.ua, onUaDetectFailed: tempUserMapInfo.onUserAgentDetectFailed }));
}
async function getShareInfo(urlQuery, request, respone) {
    if (!serverConfig.enableShare) {//关闭分享功能
        //一般不能触发这个(输入分享码就被拦下来)
        logCore.writeWarn(`有用户尝试在关闭分享功能时查询分享文件:\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ statu: 403 }));
        return
    }
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户获取分享文件详情信息时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //获取信息
    const fileInfo = await shareCoreInstance.getShareInfo(urlQuery.file);
    if (fileInfo === null) {//找不到文件
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ statu: 404 }));
        logCore.writeLog(`有用户尝试获取不存在分享文件的详情信息\nIP:${getRequestIpAddress(request)}`);
        return
    }
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ statu: 200, name: fileInfo.file, size: fileInfo.size, sharer: regUsers.get(fileInfo.sharer)?.nickName }));
}
async function downloadShare(urlQuery, request, respone) {
    if (!serverConfig.enableShare) {//关闭分享功能
        //一样要日志
        logCore.writeWarn(`有用户尝试在关闭分享功能时下载分享文件:\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(200).end("The share function disabled with admin");
        return
    }
    if (!authenticationFunction(request)) {//鉴权 反正就是必须登录
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户下载分享文件时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const filePath = shareCoreInstance.requestDownload(urlQuery.id);
    if (filePath === null) {
        logCore.writeWarn(`无法根据分享ID找到文件:${urlQuery.id}`);
        respone.writeHead(404).end("File Not Found");
        return
    }
    //文件是否存在
    if (!await fs.exists(filePath.path)) {
        logCore.writeWarn(`分享文件不存在:${filePath.path}`);
        respone.writeHead(404).end("File Not Found");
    }
    statistics.download++;
    logCore.writeVerbose(`分享文件:${filePath.name}被下载`);
    respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI(filePath.name.toString())}"` });
    fs.createReadStream(filePath.path).pipe(respone);
}
async function getAllSharedFile(urlQuery, request, respone) {//用户管理自己的分享 不用禁
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户获取自身分享时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const allSharedCookie = cookie.parse(request.headers.cookie || "");
    const sharedList = shareCoreInstance.getAllShared(allSharedCookie.account);
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify(sharedList));
}
async function removeShare(urlQuery, request, respone) {//移除用户自己的分享
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户移除自身分享时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const removeShareCookie = cookie.parse(request.headers.cookie || "");
    const shareInfo = await shareCoreInstance.getShareInfo(urlQuery.id);
    if (shareInfo == undefined) {
        logCore.writeWarn(`用户"${removeShareCookie.account}"尝试移除不存在的分享\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(200).end("false");
        return
    } else if (shareInfo?.sharer !== removeShareCookie.account) {
        provisionalBanip.addBan(getRequestIpAddress(request));
        logCore.writeWarn(`用户"${removeShareCookie.account}"尝试移除其他用户分享\nIP:${getRequestIpAddress(request)}`);
        respone.writeHead(200).end("false");
        return
    }
    logCore.writeVerbose(`用户"${removeShareCookie.account}"移除了自身文件分享:${shareInfo.file}`);
    logCore.writeAccountLog(removeShareCookie.account, `移除了自身分享:${shareInfo.file}`);
    respone.writeHead(200).end(shareCoreInstance.removeShare(urlQuery.id, removeShareCookie.account).toString());
}
async function destroyAccount(request, respone) {//注销
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户申请注销时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const destroyCookie = cookie.parse(request.headers.cookie || "");
    if (!regUsers.has(destroyCookie.account)) {
        respone.writeHead(200).end("FAILED");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`未找到申请注销的账户:${destroyCookie.account}`);
        return
    }
    try {
        const regTemp = regUsers.get(destroyCookie.account);
        regTemp.enabled = false;
        regUsers.set(destroyCookie.account, regTemp);
        logCore.writeLog(`账户"${destroyCookie.account}"已被设置为停用(注销)`);
        logCore.writeAccountLog(destroyCookie, `账户已停用`);
    } catch (error) {
        logCore.writeError(`注销账户时发生异常:\n${error.stack}`);
        respone.writeHead(200).end("FAILED");
        return
    }
    respone.writeHead(200).end("SUCCESS");
}
async function registerAccount(urlQuery, request, respone) {
    if (!serverConfig.enableRegister) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 106, msg: "Disabled" }));
        return
    }
    //空内容校验
    if (urlQuery.account === undefined || urlQuery.password === undefined || urlQuery.email === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        logCore.writeWarn(`注册新账户时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    //输入长度校验
    //过短
    if ([urlQuery.account, urlQuery.password, urlQuery.email].some(value => { return value.length <= 3 })) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 101, msg: "Length" }));
        logCore.writeWarn(`注册账户时输入不规范\nIP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    //过长
    if (urlQuery.account.length > 16 || urlQuery.email.length > 48 || urlQuery.password.length > 64) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 101, msg: "Length" }));
        logCore.writeWarn(`注册账户时输入不规范\nIP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    //邮箱重复
    //如果没开启验证码才检查 避免白费性能
    if (!serverConfig.registerVerify) {
        for (const iterator of regUsers.keys()) {
            const mail = regUsers.get(iterator).email;
            if (mail === urlQuery.email) {
                logCore.writeLog(`尝试注册的新账户使用了被使用过的邮箱:${mail}\nIP:${getRequestIpAddress(request)}`);
                respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 108, msg: "Email" }));
                return
            }
        }
    }
    //如果需要验证码
    if (serverConfig.registerVerify) {
        if (!RegisterVerify.verify(urlQuery.email, urlQuery.verify, false)) {
            logCore.writeLog(`邮箱"${urlQuery.email}"注册时输入错误验证码`);
            respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 108, msg: "Verify" }));
            return
        }
    }
    //排除不规范字符 邮箱不验证(@字符)
    if ([urlQuery.account, urlQuery.password].some(value => { return !spWordFilter.test(value) })) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 104, msg: "Word" }));
        logCore.writeWarn(`注册账户时输入不规范\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //避免用户名出现屏蔽词 刚注册的号昵称就是用户名
    if (sensitiveWordsFilterInstance.hasSensitiveWords(urlQuery.account)) {
        respone.writeHead(200).end(JSON.stringify({ code: 105, msg: "Sensitive" }));
        logCore.writeLog(`注册时用户名包含屏蔽词:${urlQuery.account}`);
        return
    }
    if (process.platform === "win32") {
        if (windowsFilterName.has(urlQuery.account.slice(0, urlQuery.account.indexOf(".") === -1 ? urlQuery.account.length : urlQuery.account.indexOf(".")).toUpperCase())) {
            logCore.writeWarn(`注册账户时用户名为Windows保留字 IP"${getRequestIpAddress(request)}`);
            respone.writeHead(200).end(JSON.stringify({ code: 107, msg: "win32" }));
            return
        }
    }
    //邮箱
    if (!emailReg.test(urlQuery.email)) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 102, msg: "Email" }));
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`注册账户时输入不规范(邮箱)\nIP:${getRequestIpAddress(request)}`);
        return
    }
    //账号是否已被注册
    if (regUsers.has(urlQuery.account)) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 103, msg: "RepeatAccount" }));
        logCore.writeVerbose(`欲注册的用户名已被使用:${urlQuery.account}`);
        return
    }
    //开启ip注册限制
    if (serverConfig.limitRegisterEveryday) {
        const regIp = getRequestIpAddress(request);
        if (limitRegEveryday.has(regIp)) {//如果有该ip注册记录
            //检测次数
            const regCountData = limitRegEveryday.get(regIp);
            //先检测日期
            if (regCountData.day !== (new Date().getDay())) {//如果与当前日期不一致则设置注册次数为1并放行
                limitRegEveryday.set(regIp, { count: 1, day: new Date().getDay() });
                logYellow("resetDay");
            } else {//同一日则检测数量是否超出设定
                if ((regCountData.count) + 1 <= serverConfig.maxEverydayRigister) {//如果已注册数量小于设定
                    //增加计数
                    limitRegEveryday.set(regIp, { count: regCountData.count + 1, day: regCountData.day });
                } else {
                    //否则阻止注册
                    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 109, msg: "ipLimit" }));
                    logCore.writeVerbose(`IP"${regIp}"已达到每日注册账户数限制`);
                    return
                }
            }
        } else {//无记录 创建并设置注册数为1
            limitRegEveryday.set(regIp, { count: 1, day: new Date().getDay() });
        }
    }
    RegisterVerify.deleteVerify(urlQuery.email);
    //设置数据
    regUsers.set(urlQuery.account, {
        password: urlQuery.password,
        permission: "user",
        storage: serverConfig.defaultNewUserStorage,
        nickName: urlQuery.account,
        email: urlQuery.email,
        uaDetectEnable: false,
        enableShare: true,
        ua: "",
        onUserAgentDetectFailed: "ua",
        enabled: true
    });
    // 文件夹处理
    await fs.ensureDir(`${storagePath}${urlQuery.account}/`);
    statistics.register++;
    logCore.writeLog(`已注册新账户:${urlQuery.account}`);
    logCore.writeAccountLog(urlQuery.account, "账户已创建");
    computeSpace(`${storagePath}${urlQuery.account}/`, urlQuery.account, true)
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 200, msg: "Done" }));
}
function getHttpsPort(respone) {//返回https开启状态及端口
    if (serverConfig.enableHTTPS && httpsWorking) {//已开启并且启动成功
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 200, port: serverConfig.portForHTTPS }));
        return
    } else if (serverConfig.enableHTTPS && !httpsWorking) {//已开启但启动失败
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 500 }));
        return
    }
    //未开启
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 403 }));
}
async function initPublicFiles() {
    logCore.writeLog("Loading public files list")
    const finalList = [];
    const fileList = await fs.readdir("./_publicFiles/");
    for (let filePath of fileList) {
        let sameSize = (await fs.stat(`./_publicFiles/${filePath}`)).size;
        finalList.push({
            name: filePath,
            size: sameSize
        })
    }
    logCore.writeInfo("Public files list initlalized")
    return finalList
}
async function downloadPublicFile(urlQuery, request, respone) {
    if (urlQuery.name === undefined || urlQuery.name === "") {
        respone.writeHead(500).end("Invaild arguments");
        logCore.writeWarn(`下载公开文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (path.relative("./_publicFiles/", `./_publicFiles/${urlQuery.name}`) !== urlQuery.name) {
        respone.writeHead(418).end("I'm a Teapot");
        provisionalBanip.addBan(getRequestIpAddress(request));
        logCore.writeWarn(`有用户尝试在下载公开文件时访问服务器其他路径\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (!await fs.exists(`./_publicFiles/${urlQuery.name}`)) {
        logCore.writeWarn(`未找到请求下载的公开文件:${urlQuery.name}`);
        respone.writeHead(404).end("File not found");
        return
    }
    respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI(urlQuery.name.toString())}"` });
    logCore.writeVerbose(`公开文件"${urlQuery.name}"被下载`);
    fs.createReadStream(`./_publicFiles/${urlQuery.name}`).pipe(respone);
}
async function streamMediaForPublicFlies(urlQuery, request, respone) {
    if (urlQuery.name === undefined || urlQuery.name === "") {
        respone.writeHead(500).end("Invaild arguments");
        provisionalBanip.addCount(getRequestIpAddress(request));
        logCore.writeWarn(`播放公开文件时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (path.relative("./_publicFiles/", `./_publicFiles/${urlQuery.name}`) !== urlQuery.name) {
        respone.writeHead(418).end("I'm a Teapot");
        provisionalBanip.addBan(getRequestIpAddress(request));
        logCore.writeWarn(`有用户尝试在播放公开文件时访问服务器其他路径\nIP:${getRequestIpAddress(request)}`);
        return
    }
    if (!await fs.exists(`./_publicFiles/${urlQuery.name}`)) {
        respone.writeHead(404).end("File not found");
        logCore.writeWarn(`未找到将播放的公开文件:${urlQuery.name}`);
        return
    }
    try {
        fs.createReadStream(`./_publicFiles/${urlQuery.name}`).pipe(respone);
        logCore.writeVerbose(`公开文件"${urlQuery.name}"被播放`);
        return
    } catch (err) {
        respone.writeHead(500).end("Create read stream error");
        logCore.writeError(`播放公开文件时发生异常:\n${err.stack}`);
        return
    }
}
async function userDownloadLog(request, respone) {
    if (!authenticationFunction(request)) {//鉴权
        respone.writeHead(403).end("Authentication failed");
        logCore.writeWarn(`用户申请注销时鉴权失败.\nIP:${getRequestIpAddress(request)}`);
        return
    }
    const logDownloadCookie = cookie.parse(request.headers.cookie || "");
    if (!fs.exists(`./_logs/user_logs/${logDownloadCookie.account}.log`)) {//确保文件存在
        respone.writeHead(404).end();
        return
    }
    try {
        respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI("AccountLog.log")}"` });
        fs.createReadStream(`./_logs/user_logs/${logDownloadCookie.account}.log`).pipe(respone);
    } catch (error) {
        respone.writeHead(500).end();
    }
}
async function resetPassword_sendCode(urlQuery, request, respone) {
    if (!serverConfig.enableResetPassword) {
        respone.writeHead(200).end("DISABLED");
        logCore.writeWarn(`用户在关闭重置密码功能时发起请求 IP:${getRequestIpAddress(request)}`);
        return
    }
    //数据长度
    if (urlQuery.account?.length > 16 || urlQuery.account?.length <= 3 || urlQuery.email?.length > 64) {
        logCore.writeWarn(`重置账户密码时输入长度不合规 IP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(403).end();
        return
    }
    //邮箱格式
    if (!emailReg.test(urlQuery.email || "")) {
        logCore.writeWarn(`重置账户密码时输入邮箱格式校验失败 IP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(403).end();
        return
    }
    // 检测账户是否存在及是否被停用
    const userData = regUsers.get(urlQuery.account);
    if (userData === undefined || !userData.enabled) {
        respone.writeHead(404).end();
        logCore.writeVerbose(`用户重置密码时输入不存在或已停用账户:${urlQuery.account}`);
        return
    }
    // 邮箱
    if (userData.email !== urlQuery.email) {
        respone.writeHead(404).end();
        logCore.writeVerbose(`用户尝试重置账户"${urlQuery.account}"密码时输入错误邮箱:${urlQuery.email}`);
        logCore.writeAccountLog(urlQuery.account, `尝试重置密码时输入错误邮箱:${urlQuery.email}`);
        return
    }
    const allowMail = ResetPassword.allowSendMail(urlQuery.account);
    //检查是否允许发送邮件 否则返回
    if (allowMail !== "OK") {
        respone.writeHead(200).end(allowMail);
        return
    }
    // 生成验证码并发送
    const code = RT.number(6);
    //检查邮箱配置是否正常 端口号范围等
    for (let value of Object.values(serverConfig.mailerConfig)) {
        if (value === null) {
            respone.writeHead(200).end("CONFIG");
            logCore.writeWarn(`由于配置异常验证码邮件发送失败:配置文件不应出现NULL`);
            return
        }
    }
    if (isNaN(serverConfig.mailerConfig.port) || serverConfig.mailerConfig.port < 0 || serverConfig.mailerConfig.port > 65535) {//端口号
        respone.writeHead(200).end("CONFIG");
        logCore.writeWarn("由于配置异常验证码邮件发送失败:端口号应为0-65535间数字");
        return
    }
    // 返回并发送验证码
    if (serverConfig.debug) logCore.writeLog(`账户"${urlQuery.account}"的重置密码验证码为:${code}`);
    const transport = mailer.createTransport({
        host: serverConfig.mailerConfig.host,
        port: serverConfig.mailerConfig.port,
        secure: false,
        auth: {
            user: serverConfig.mailerConfig.email,
            pass: serverConfig.mailerConfig.pass
        }
    });
    try {
        await transport.sendMail({
            from: serverConfig.mailerConfig.email,
            to: userData.email,
            subject: `${serverConfig.debug ? "[开发模式:验证码邮件测试]" : ""}WebDisk重置密码验证邮件`,
            text: ` ${code} 是您的验证码\n五分钟内有效\n(自动发送请勿回复)`
        });
    } catch (error) {
        respone.writeHead(200).end("EXCEPTION");
        return
    }
    respone.writeHead(200).end("OK");
    logCore.writeLog(`发送账户"${urlQuery.account}的重置验证码`);
    ResetPassword.addAccount(urlQuery.account, code.toString());
}
async function resetPassword_verifyCode(urlQuery, request, respone) {
    if (!serverConfig.enableResetPassword) {
        respone.writeHead(200).end("FAILED");
        return
    }
    if (ResetPassword.verify(urlQuery.account, urlQuery.code, true)) {
        const token16 = RT.number_en(16);//设定密码用临时标记 重置完成后删除
        ResetPassword.tokenTemp.set(urlQuery.account, token16);
        respone.writeHead(200).end(token16);
        logCore.writeVerbose(`用户"${urlQuery.account || "无法获取"}"重置密码验证码输入完成`);
    } else {
        logCore.writeLog(`账户"${urlQuery.account || "无法获取"}"重置密码时输入错误验证码`);
        respone.writeHead(200).end("FAILED");
    }
}
async function resetPassword_newPassword(urlQuery, request, respone) {
    if (!serverConfig.enableResetPassword) {
        respone.writeHead(200).end("INVAILD DATA");
        return
    }
    // 合规性检测
    if (urlQuery.pwd === undefined) {
        respone.writeHead(500).end("Invaild arguments");
        logCore.writeWarn(`重置密码时传入无效参数\nIP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        return
    }
    if (urlQuery.pwd.length <= 3 || urlQuery.pwd.length > 64) {//长度
        logCore.writeWarn(`用户"${urlQuery.account || "无法获取"}"重置密码时数据合规性校验失败 IP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead("200").end("INVAILD DATA");
        return
    }
    if (!spWordFilter.test(urlQuery.pwd)) {//内容
        logCore.writeWarn(`重置密码时数据合规性校验失败 IP:${getRequestIpAddress(request)}`);
        respone.writeHead("200").end("INVAILD DATA");
        return
    }
    //检查token并处理
    if (ResetPassword.tokenTemp.get(urlQuery.account) === urlQuery.token) {
        const userData = regUsers.get(urlQuery.account);
        userData.password = urlQuery.pwd;
        logCore.writeLog(`用户${urlQuery.account}重置密码`);
        respone.writeHead(200).end("OK");
        return
    }
    logCore.writeWarn(`重置密码时的无效Token\n账户:${urlQuery.account || "无法获取"}\nIP:${getRequestIpAddress(request)}`);
    respone.writeHead(200).end("INVAILD TOKEN");
}
async function sendRegisterVerify(urlQuery, request, respone) {
    if (!serverConfig.enableRegister) {
        logCore.writeWarn(`尝试在关闭注册功能时发送注册验证码 IP:${getRequestIpAddress(request)}`);
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 106, msg: "Disabled" }));
        return
    }
    if (urlQuery.email === undefined) {
        logCore.writeWarn(`注册账户时传入无效参数 IP:${getRequestIpAddress(request)}`);
        provisionalBanip.addCount(getRequestIpAddress(request));
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 300, msg: "MissingArguments" }));
        return
    }
    // 检查邮箱是否被使用
    //Map.foreach不能return跳出
    for (const iterator of regUsers.keys()) {
        const mail = regUsers.get(iterator).email;
        if (mail === urlQuery.email) {
            logCore.writeLog(`尝试注册的新账户使用了被使用过的邮箱:${mail}\nIP:${getRequestIpAddress(request)}`);
            respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 600, msg: "Email" }));
            return
        }
    }
    if (!emailReg.test(urlQuery.email)) {
        logCore.writeWarn(`尝试注册账户时传入了不正确的邮箱 IP:${getRequestIpAddress(request)}`);
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 403, msg: "EmailFormet" }));
        return
    }
    switch (RegisterVerify.allowSendMail(urlQuery.email)) {
        case "TIME":
            respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 601, msg: "TIME" }));
            return
        case "COUNT":
            respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 602, msg: "Email" }));
            return
    }
    const verify = RT.number(6);
    RegisterVerify.addAccount(urlQuery.email, verify);
    logCore.writeLog(`邮箱"${urlQuery.email}"发起注册验证请求`);
    //检查邮箱配置是否正常 端口号范围等
    for (let value of Object.values(serverConfig.mailerConfig)) {
        if (value === null) {
            respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 605, msg: "config" }));
            logCore.writeWarn(`由于配置异常验证码邮件发送失败:配置文件不应出现NULL`);
            return
        }
    }
    if (isNaN(serverConfig.mailerConfig.port) || serverConfig.mailerConfig.port < 0 || serverConfig.mailerConfig.port > 65535) {//端口号
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 605, msg: "config" }));
        logCore.writeWarn("由于配置异常验证码邮件发送失败:端口号应为0-65535间数字");
        return
    }
    //发送邮件
    if (serverConfig.debug) logCore.writeLog(`邮箱"${urlQuery.email}"的注册验证码为:${verify}`);
    const transport = mailer.createTransport({
        host: serverConfig.mailerConfig.host,
        port: serverConfig.mailerConfig.port,
        secure: false,
        auth: {
            user: serverConfig.mailerConfig.email,
            pass: serverConfig.mailerConfig.pass
        }
    });
    try {
        await transport.sendMail({
            from: serverConfig.mailerConfig.email,
            to: urlQuery.email,
            subject: `${serverConfig.debug ? "[开发模式:验证码邮件测试]" : ""}WebDisk账户注册验证邮件`,
            text: ` ${verify} 是您的验证码\n五分钟内有效\n如非您本人操作可能是他人注册时误输入了您的邮箱 还请忽略\n(自动发送 请勿回复)`
        });
    } catch (error) {
        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 604, msg: "Exception" }));
        return
    }
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify({ code: 200, msg: "OK" }));
}
async function initConfigSocket() {
    let wss;
    logCore.writeInfo(`开启配置Websocket`);
    try {
        wss = https.createServer({ key: fs.readFileSync("./assets/https/server.key"), cert: fs.readFileSync("./assets/https/server.crt") }, (req, res) => {
            req.destroy();
            res.destroy();
        }).listen(60127);
    } catch (error) {
        logCore.writeError("启动配置Websocket失败:" + error.stack);
        return
    }
    bgWebsocket = new WebSocket({ server: wss });
    bgWebsocket.on("connection", (socket, request) => {
        if ((cookie.parse(request.headers.cookie || "")).wsKey === process.argv[2] && bgWebsocket.clients.size <= 1) {
            logCore.writeDebug(`配置Websocket已连接 IP:${getRequestIpAddress(request)}`);
            socket.on("message", data => {
                let wsJson;
                try {
                    wsJson = JSON.parse(data);
                } catch (error) {
                    logCore.writeError(`Failed to parse data object\nIP${getRequestIpAddress(request)}`);
                    socket.close();
                }
                switch (wsJson.action) {
                    case "GETSTATISTICE":
                        socket.send(JSON.stringify({ action: "RESPONE_STATISTICE", data: Object.assign({ serverState: "Running" }, statistics) }));
                        logCore.writeDebug("已返回统计信息");
                        break
                    case "GETSHARES":
                        socket.send(JSON.stringify({ action: "RESPONE_SHARE", data: shareCoreInstance.getAllUserShares() }));
                        logCore.writeDebug("已返回所有用户分享");
                        break
                    case "GETNICKNAMEEXLIST":
                        socket.send(JSON.stringify({ action: "RESPONE_NICKNAMEEX", data: nickNameExamineInstance.nickList }));
                        logCore.writeDebug("已返回昵称待审列表");
                        break
                    case "GETACCOUNTS":
                        socket.send(JSON.stringify({ action: "RESPONE_ACCOUNTS", data: Object.fromEntries(regUsers) }));
                        logCore.writeDebug("已返回所有账户");
                        break
                    case "GETBANIP":
                        socket.send(JSON.stringify({ action: "RESPONE_BANIP", data: Array.from(banip) }));
                        logCore.writeDebug(`已返回封禁IP列表`);
                        break
                    case "ADDBANIP":
                        if (wsJson.data == undefined || wsJson.data == "") {
                            socket.send(JSON.stringify({ action: "RESPONE_ADDBANIP", code: 2 }));
                            logCore.writeWarn("后台封禁ip请求参数异常");
                            return
                        }
                        if (banip.has(wsJson.data)) {
                            socket.send(JSON.stringify({ action: "RESPONE_ADDBANIP", code: 1 }))
                            logCore.writeLog("添加失败:IP重复")
                            return
                        }
                        banip.add(wsJson.data);
                        socket.send(JSON.stringify({ action: "RESPONE_ADDBANIP", code: 0 }))
                        logCore.writeLog(`封禁IP成功:${wsJson.data}`);
                        break
                    case "CREATEACCOUNT":
                        if (regUsers.has(wsJson.data.account)) {//防止重复用户名
                            logCore.writeLog(`后台账户创建请求"${wsJson.data.account}"处理失败:已存在该用户名`);
                            socket.send(JSON.stringify({action:"RESPONE_CREATEACCOUNT",data:{code:1}}));
                            return
                        }
                        if (wsJson.data.account == undefined || wsJson.data.password == undefined || wsJson.data.email == undefined) {
                            logCore.writeWarn(`网页后台注册账户时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            socket.send(JSON.stringify({action:"RESPONE_CREATEACCOUNT",data:{code:2}}))
                            return
                        }
                        if (wsJson.data.account == "" || wsJson.data.password == "" || wsJson.data.email == "") {
                            logCore.writeWarn(`网页后台注册账户时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            socket.send(JSON.stringify({action:"RESPONE_CREATEACCOUNT",data:{code:2}}));
                            return
                        }
                        socket.send(JSON.stringify({action:"RESPONE_CREATEACCOUNT",data:{code:0}}))
                        regUsers.set(wsJson.data.account, {
                            password: wsJson.data.password,
                            permission: "user",
                            storage: serverConfig.defaultNewUserStorage,
                            nickName: wsJson.data.account,
                            email: wsJson.data.email,
                            uaDetectEnable: false,
                            ua: "",
                            enableShare: true,
                            onUserAgentDetectFailed: "ua",
                            enabled: true
                        });
                        fs.ensureDir(`${storagePath}${wsJson.data.account}/`).then(() => {
                            computeSpace(`${storagePath}${wsJson.data.account}/`, wsJson.data.account, true);
                        })
                        logCore.writeInfo(`后台发起账户创建请求"${wsJson.data.account}"处理完成`);
                        break
                    case "GETACCOUNTINFO":
                        socket.send(JSON.stringify(Object.assign({action:"RESPONE_ACCOUNTINFO"},regUsers.get(wsJson.data)||{accountNotFound:true})));
                        logCore.writeDebug(`获取了账户信息:${wsJson.data}`);
                        break
                    default:
                        logCore.writeWarn(`未知的配置Websocket信号:${wsJson.action}\nIP:${getRequestIpAddress(request)}`);
                        socket.close()
                }
            })
        } else {
            logCore.writeWarn(`配置Websocket连接验证失败或已有连接 IP:${getRequestIpAddress(request)}`);
            socket.send('{"action":"VERIFY_FAILED"}');
            socket.close();
        }
    });
    logCore.writeInfo(`开启配置Websocket完成`);
}
/**
 *@description 删除所有被停用账户的数据
 *@returns {Number} 清除的账户数量
 */
async function deleteDisabledAccount() {
    let cleared = 0;
    for (const userName of regUsers.keys()) {
        if (!regUsers.get(userName).enabled) {
            deleteAccount(userName, true);
            cleared++;
        }
    }
    return cleared;
}
/**
 * @description 彻底清除一个账户
 * @returns {boolean} 执行成功与否
 * @param {String} account
 * @param {Boolean} [removeStorage=false] 是否删除存储空间文件
 */
async function deleteAccount(account, removeStorage = false) {
    if (regUsers.has(account)) {
        const ReadyDeleteaAccountToken = userTokens.get(account);
        // 清除分享
        shareCoreInstance.removeAccountAllShare(account);
        if (removeStorage) {
            if (uploadingUserToken.has(ReadyDeleteaAccountToken)) {
                try {
                    uploadingUserToken.get(ReadyDeleteaAccountToken).pipe.destroy();
                    fs.remove(uploadingUserToken.get(ReadyDeleteaAccountToken).pipe.path);
                } catch (error) {
                    logRed(`移除账户文件时发生异常:${error.stack}`);
                    return false
                }
            }
            try {
                fs.remove(`${storagePath}${account}/`);
            } catch (error) {
                logRed(`移除账户文件时发生异常:${error.stack}`);
                return false
            }
        }
        regUsers.delete(account);
        userTokens.delete(account);
        return true
    }
    //找不到账户
    return false
}
/**
 * @description 检查是否含有xss攻击敏感字符
 * @param str {String} 要检查的字符串 
 * @return {Boolean} 结果 
 */
function detectXssString(str = "") {
    for (let word of xssWord) {
        if (str.toString().includes(word)) {
            return true
        }
    }
    return false
}
function logYellow(...str) {
    console.log(`\x1B[33m${str}\x1b[0m`);
}
function logRed(...str) {
    console.log("\x1B[31m" + str + "\x1b[0m");
}
function logGreen(...str) {
    console.log("\x1B[32m" + str + "\x1b[0m");
}
/**
     * @param {string} [str="null"]
     * @return {boolean} 
     * @memberof CS
     * @description 判断字符串是否为true或false
     */
function isBooleanStr(str = "null") {
    return (str === "true" || str === "false")
}

/**
 * @param {http.OutgoingMessage} socket
 * @param {string} data
 */
async function responeSocket(socket, data = "") {
    const resp = httpHeader + `Content-Length: ${Buffer.byteLength(data, "utf-8")}\r\n\r\n${data}`;
    socket.write(resp);
    socket.end();
}
function shutdownServer(signal = false, closeConnections = "true") {
    //支持管理员面板关闭
    logCore.writeLog("Colseing server...");
    commandSystemInstance.rlInterface.close();
    if (closeConnections === "true") {
        server.closeAllConnections();
        server.closeIdleConnections();
    }
    if (httpsWorking && closeConnections === "true") {
        httpsServer.closeAllConnections();
        httpsServer.closeIdleConnections();
    }
    if (httpsWorking) httpsServer.close();
    server.close(async error => {
        if (error) {
            logCore.writeError(`Error on shutdowning server:\n${error.stack}`);
        }
        logCore.writeInfo("服务器已关闭 保存数据中");
        //关闭ws
        logCore.closeWebSocket();
        if (bgWebsocket!==null) bgWebsocket.close();
        //保存数据
        //regUsers.json
        await $data_regUsers();
        await $data_userTokens();
        await $data_config();
        await $data_banip();
        await nickNameExamineInstance.saveExamineMap();
        await shareCoreInstance.saveSharesMap();
        if (signal) process.send({ signal: "CLOSED" });//向父进程发送已关闭信号
        logCore.writeInfo("Server closed");
        process.exit(0);
    });
    //再次断开连接 免得卡住
    setTimeout(() => {
        if (closeConnections === "true") {
            server.closeAllConnections();
            server.closeIdleConnections();
        }
        if (httpsWorking && closeConnections === "true") {
            httpsServer.closeAllConnections();
            httpsServer.closeIdleConnections();
        }
    }, 1250);
}
async function $data_regUsers() {
    //调试完再改回去
    // logCore.writeDebug("Saveing regUsers.json...");
    await fs.writeJSON("./_server_data/regUsers.json", Object.fromEntries(regUsers));
    //logCore.writeLog("Saved regUsers.json")
}
async function $data_userTokens() {
    //logCore.writeLog("Saveing userTokens.json...");
    await fs.outputJSON("./_server_data/userTokens.json", Object.fromEntries(userTokens));
    // logCore.writeLog("Saved userTokens.json")
}
async function $data_banip() {
    await fs.outputJSON("./_server_data/banip.json", Array.from(banip));
}
async function $data_config() {
    await fs.writeJSON("./config.json", serverConfig);
}
setInterval(() => {//自动保存
    $data_regUsers();
    $data_userTokens();
    $data_banip();
    nickNameExamineInstance.saveExamineMap();
    shareCoreInstance.saveSharesMap();
}, /* 30*60*1000 */serverConfig.debug ? 10000 : parseInt(serverConfig.autoSaveTimer) || (30 * 60 * 1000)/* 如出现异常则设置为30min */);
//崩溃处理
process.on("uncaughtException", uncaught => {
    logCore.writeError(`发生未捕获的异常:\n${uncaught.stack}`);
})
process.on("SIGINT", () => { });//防止直接被关
process.on("message", (value, socket) => {
    if (!serverConfig.enabledWebBackground && value.signal !== "SHUTDOWN") {
        logCore.writeWarn(`Web后台关闭时接收到信号:${value.signal}`);
        return
    }
    logCore.writeDebug(`接收到父进程信号:${value.signal}`);
    switch (value.signal) {
        case "SHUTDOWN"://关闭
            shutdownServer(value.sendSignal, value.closeAllConnections);
            break;
        case "CONFIG_RELOAD"://重新加载配置信息
            serverConfig = fs.readJsonSync("./config.json");
            provisionalBanip.enable = serverConfig.autoProvisionalBanip;
            logCore.writeLog("Config reloaded");
            break
        case "REQUEST_STATISTICE"://请求返回统计信息
            responeSocket(socket, JSON.stringify(Object.assign({ serverState: "Running" }, statistics)));
            logCore.writeVerbose("已返回统计信息");
            break
        case "REQUEST_USERSHARE"://请求分享列表
            responeSocket(socket, JSON.stringify(shareCoreInstance.getAllUserShares()));
            logCore.writeDebug("已返回所有分享")
            break
        case "REQUEST_ACCOUNTS"://请求账户列表
            responeSocket(socket, JSON.stringify(Object.fromEntries(regUsers)));
            break
        case "REQUEST_ACCOUNTINFO"://请求单个账户信息
            responeSocket(socket, JSON.stringify(regUsers.get(value.account) || { accountNotFound: true }));
            break
        case "REQUEST_NICKNAMEEXAMINELIST"://请求昵称审核列表
            responeSocket(socket, JSON.stringify(nickNameExamineInstance.nickList));
            break
        case "REQUEST_GETBANIP":
            responeSocket(socket, JSON.stringify(Array.from(banip)));
            break
        case "ACTION_REMOVEUSERSHARE"://移除分享 不设返回
            shareCoreInstance.removeShare(value.data.id, value.data.sharer);
            break
        case "ACTION_SETACCOUNTINFO"://设置单账户信息
            if (value.account == undefined || value.key == undefined || value.value == undefined) {
                logCore.writeWarn(`网页后台更改用户配置时出现无效参数`);
                return
            }
            const tempUserConfig = regUsers.get(value.account);
            if (tempUserConfig[value.key] === undefined) {
                logCore.writeDebug(`更改失败 不存在该属性:${value.key}`);
                return
            }
            tempUserConfig[value.key] = value.value;
            if (value.key === "storage") {//更改存储空间后需要重新获取剩余存储空间
                computeSpace(`${storagePath}${value.account}/`, value.account, true);
            }
            logCore.writeDebug("更改成功");
            break
        case "ACTION_RESETUSERTOKEN"://重置单账户登录Token
            userTokens.set(value.account, { token: RT.number_en(32) });
            break
        case "ACTION_CREATEACCOUNT"://创建账户
            if (regUsers.has(value.account)) {//防止重复用户名
                logCore.writeLog(`后台账户创建请求"${value.account}"处理失败:已存在该用户名`);
                responeSocket(socket, JSON.stringify({ code: 1 }));
                return
            }
            responeSocket(socket, JSON.stringify({ code: 0 }));
            regUsers.set(value.account, {
                password: value.password,
                permission: "user",
                storage: serverConfig.defaultNewUserStorage,
                nickName: value.account,
                email: value.email,
                uaDetectEnable: false,
                ua: "",
                enableShare: true,
                onUserAgentDetectFailed: "ua",
                enabled: true
            });
            fs.ensureDir(`${storagePath}${value.account}/`).then(() => {
                computeSpace(`${storagePath}${value.account}/`, value.account, true);
            })
            logCore.writeInfo(`后台发起账户创建请求"${value.account}"处理完成`);
            break
        case "ACTION_NICKNAMEEXAMINE"://昵称审核 成功及失败
            if (value.agree) {
                const tempUserData = regUsers.get(value.account);
                tempUserData.nickName = nickNameExamineInstance.nickMap.get(value.account).newName;
            }
            nickNameExamineInstance.removeExamine(value.account);
            break
        case "ACTION_REFRESHPUBLICFILE"://刷新共享文件列表
            initPublicFiles().then(value => {
                publicFileList = value;
            });
            break
        case "ADDBANIP":
            if (value.ip == undefined || value.ip == "") {
                responeSocket(socket, JSON.stringify({ code: 2 }));
                logCore.writeWarn("后台封禁ip请求参数异常");
                return
            }
            if (banip.has(value.ip)) {
                responeSocket(socket, JSON.stringify({ code: 1 }));
                logCore.writeLog("添加失败:IP重复")
                return
            }
            banip.add(value.ip);
            responeSocket(socket, JSON.stringify({ code: 0 }));
            break
        case "REMOVEBANIP":
            if (value.ip == undefined || value.ip == "") {
                logCore.writeWarn("后台解封ip请求参数异常");
                return
            }
            banip.delete(value.ip);
            logCore.writeLog(`移除IP封禁:${value.ip}`);
            break
        case "SETUP_WEBBG_SOCKET":
            initConfigSocket();
            break
        default://未知信号
            logCore.writeWarn(`Unknown signal:${value.signal}`)
            break;
    }
});
console.log(`\x1B[33m输入 help 查看所有命令\n按下Ctrl+D关闭命令输入功能\x1b[0m`);