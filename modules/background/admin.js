const fs = require("fs-extra");
const http = require("http");
const https = require("https");
const url = require("url");
const RT = require("randomthing-js");
const cookie = require("cookie");
const { sleep } = require("../coreInit.js");
const PBIP = require("../provisionalBanip");
let serverConfig = fs.readJsonSync("./config.json");
fs.ensureDirSync("./_logs/");
const logCoreAdmin = new (require("../logCore.js"))("./_logs/admin.log", serverConfig.debug, serverConfig.maxLogArrayLength, 9981, process.argv[2],serverConfig.enableHTTPS);
logCoreAdmin.writeLog("Admin background server starting...");
const loginHtml = fs.readFileSync("./assets/html/background/adminLoginGUI.html");
const managerHtml = fs.readFileSync("./assets/html/background/backgroundMain.html");
const accountInfoHtml = fs.readFileSync("./assets/html/background/accountInfo.html");
const wsLogHtml = fs.readFileSync("./assets/html/background/wsLogs.html");
const bgMainJs = fs.readFileSync("./assets/js/webAdmin.js");
const bgMainCss = fs.readFileSync("./assets/css/webAdminStyle.css");
const switchBitmapTrue = fs.readFileSync("./assets/bitmap/html_switch_true.png");
const switchBitmapFasle = fs.readFileSync("./assets/bitmap/html_switch_false.png");
const iconIcoFile = fs.readFileSync("./assets/logo.ico")
const windowsFilterName = process.platform === "win32" ? new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]) : void (0);
const enabledConfig=new Set(["mailerConfig","limitRegisterEveryday","autoProvisionalBanip","enableResetPassword","changeNicknameExamine","enableNickName","enabledStreamMedia","enableRegister","enableShare","registerVerify","enableHTTPS",'debug'])
let token = serverConfig.debug ? "ngmhhay_ctrl_2.5year" : RT.number_en(128);//调试模式下固定Token
let httpsServer = null, httpServer = null, serverState = null;
let publicFileUploadPipe;
/**
 * @description 临时banip管理实例
 * @export provisionalBanip
 * @type {PBIP}
 */
let provisionalBanip;
let loginKey = serverConfig.backgroundRandomKey ? RT.number_en(64) : serverConfig.backgroundLoginKey;
logCoreAdmin.writeLog(`后台登录密码为:${loginKey}`);
const port = serverConfig.randomBackgroundPort ? RT.number(1000, 65535) : serverConfig.backgroundPort;
provisionalBanip = new PBIP(serverConfig.provisionalBanipTime || 300000, serverConfig.autoProvisionalBanip);
/**
 * @param {http.IncomingMessage} request
 * @param {http.OutgoingMessage} respone 
 */
function requestCallback(request, respone) {
    if (serverConfig.onlyLocalhostBackground && getRequestIpAddress(request) !== "127.0.0.1") {
        logCoreAdmin.writeLog(`IP:${getRequestIpAddress(request)}尝试访问后台管理`);
        request.destroy();
        return
    }
    if (provisionalBanip.isBanned(getRequestIpAddress(request))) {
        if (serverConfig.enableBanipTips) {
            respone.writeHead(403, "", { "Content-Type": "text/html;charset=utf-8" }).end(serverConfig.banipTipsText || "IP banned");
            logCoreAdmin.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
            return
        }
        logCoreAdmin.writeLog(`已阻止IP地址连接${getRequestIpAddress(request)}`);
        request.destroy();
        respone.destroy();
        return
    }
    if (request.method === "GET") {
        if (request.url === "/") {
            respone.writeHead(301, "Redirect", { location: "/login.admin" }).end();
            return
        }
        let urlName = (url.parse(request.url, true).pathname).replace("/", "")
        let parsedUrl = url.parse(request.url, true).query;
        if (parsedUrl.action != undefined) {
            switch (parsedUrl.action) {
                case "downloadShare":
                    if (!authentication(request)) {
                        logCoreAdmin.writeWarn(`下载分享文件鉴权失败 IP:${getRequestIpAddress(request)}`);
                        request.destroy();
                        return
                    }
                    adminDownloadShare(parsedUrl, request, respone);
                    return;
                case "downloadUserLog":
                    if (!authentication(request)) {
                        logCoreAdmin.writeWarn(`下载用户日志鉴权失败 IP:${getRequestIpAddress(request)}`);
                        request.destroy();
                        return
                    }
                    adminDownloadUserLog(parsedUrl, request, respone);
                    return
                default:
                    logCoreAdmin.writeWarn(`Unknown action:${parsedUrl.action}`);
                    respone.writeHead(501).end();
                    return;
            }
        }
        switch (urlName) {
            case "login.admin":
                serverConfig.backgroundLoginGUI ? respone.writeHead(200).end(loginHtml) : loginNotGUI(parsedUrl, respone, request);//预留
                break;
            case "manager.wpgi":
                //鉴权
                if (!authentication(request)) {
                    respone.writeHead(301, "Redirect", { location: "/login.admin" }).end();
                    return
                }
                respone.writeHead(200).end(managerHtml);
                break
            case "bgMain.js":
                respone.writeHead(200).end(bgMainJs);
                break
            case "bgStyle.css":
                respone.writeHead(200).end(bgMainCss);
                break
            case "editTheAccount.editInfoPage":
                respone.writeHead(200).end(accountInfoHtml);
                break
            case "serverLogs.wsh":
                respone.writeHead(200).end(wsLogHtml);
                break
            case "bitmap_html_switch_true.bitmap":
                respone.writeHead(200).end(switchBitmapTrue);
                break
            case "bitmap_html_switch_false.bitmap":
                respone.writeHead(200).end(switchBitmapFasle)
                break
            case "favicon.ico":
                respone.writeHead(200).end(iconIcoFile);
                break
            default:
                respone.writeHead(404).end();
                break;
        }
    } else if (request.method === "POST") {
        if (request.headers["content-type"] === "application/json") {
            let postData = '';
            request.on("data", (data) => {
                postData += data;
                if (postData.length >= 16384) {//正常情况不会出现这么大的数据
                    request.destroy();
                    postData = null;
                    logCoreAdmin.writeWarn(`POST请求接收数据大小超过阈值\nIP:${getRequestIpAddress(request)}`);
                    return
                }
            })
            request.on("end", async () => {
                let json;//发送的json
                try {//避免收到异常的json崩溃
                    json = JSON.parse(postData);
                } catch (error) {
                    respone.writeHead(501).end("Failed to parse stringify json");
                    logCoreAdmin.writeError(`序列化JSON失败\nCookie:${request.headers.cookie}\nUA:${request.headers["user-agent"]}`);
                    return
                }
                switch (json?.action) {
                    case "LOGIN"://管理员登录
                        if (json.key === loginKey) {
                            logCoreAdmin.writeInfo(`管理员登录成功\nIP:${getRequestIpAddress(request)}\nUA:${request.headers["user-agent"]}`);
                            respone.setHeader("Set-Cookie", [`adminToken=${token}`, `wsKey=${process.argv[2]}`]);
                            respone.writeHead(200).end("LOGIN");
                            return
                        }
                        logCoreAdmin.writeLog(`管理员登录失败 密码错误\nIP:${getRequestIpAddress(request)}\nUA:${request.headers["user-agent"]}`);
                        provisionalBanip.addCount(getRequestIpAddress(request));
                        respone.writeHead(200).end("Failed")
                        break;
                    case "GETCONFIG"://获取服务器配置
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取服务器配置鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify(responeConfig()));
                        break
                    case "SETCONFIG"://设置服务器配置
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`修改服务器配置鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (serverConfig[json.config] != undefined&&enabledConfig.has(json.config)) {
                            serverConfig[json.config] = json.value;
                            logCoreAdmin.writeInfo(`已将配置"${json.config}"调整为:${json.value}`);
                            //覆盖config.json 必须await返回提醒操作否则调整太快概率崩溃(可能是读取到保存了一半的json?)
                            await fs.writeJSON("./config.json", serverConfig);//覆盖config.json
                            //如果需要更新配置信息则向父进程发送更新信号 后将被转发
                            if (json.reload) process.send({ signal: "CONFIG_RELOAD" });
                            logCoreAdmin.writeVerbose(`配置已更新`);
                            respone.writeHead(200).end("OK");
                            return
                        }
                        logCoreAdmin.writeWarn(`修改服务器配置失败:${json.config}\nIP:${getRequestIpAddress(request)}`);
                        respone.writeHead(200).end("FAILED");
                        break
                    case "RESETTOKEN"://重置管理员后台登录Token
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`重置管理员登录Token鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        token = RT.number_en(128);
                        respone.writeHead(200).end("OK");
                        logCoreAdmin.writeLog("已重置管理员登录Token");
                        break
                    case "SHUTDOWN"://关服
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`关闭服务器时鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "REQUEST_SERVERSTATE" });//查询服务器状态
                        await sleep(200);//等待0.2秒避免来不及更新
                        if (serverState.running) {//正在运行则关闭服务器
                            process.send({ signal: "SHUTDOWN", sendSignal: true });
                            logCoreAdmin.writeInfo("服务器关闭指令已发送");
                            respone.writeHead(200).end("OK");
                            return
                        }
                        logCoreAdmin.writeWarn("服务器关闭失败:服务器未在运行");
                        respone.writeHead(200).end("FAILED_CLOSED");
                        break
                    case "BOOT"://启动服务器
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`启动服务器鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "REQUEST_SERVERSTATE" });//查询服务器状态
                        await sleep(200);
                        if (serverState.running) {//正在运行则阻止关闭
                            respone.writeHead(200).end("FAILED_RUNNING");
                            logCoreAdmin.writeWarn("服务器开启失败:服务器已在运行");
                            return
                        }
                        respone.writeHead(200).end("OK");
                        process.send({ signal: "BOOT" });
                        logCoreAdmin.writeInfo("服务器开启指令已发送");
                        break
                    case "DELETEPUBLICFILE"://删除共享文件
                        if (!authentication(request)) {
                            logCoreAdmin.writeWarn(`删除共享文件鉴权失败 IP:${getRequestIpAddress(request)}`);
                            request.destroy();
                            return
                        }
                        if (publicFileUploadPipe != null && !publicFileUploadPipe.closed) {//删除还在上传的文件
                            try {
                                publicFileUploadPipe.destroy();//关闭流否则报错
                                logCoreAdmin.writeVerbose("你似乎删除了一个上传后台失败的共享文件");
                            } catch (error) { }
                        }
                        await fs.remove(`./_publicFiles/${json.name}`);
                        process.send({ signal: "ACTION_REFRESHPUBLICFILE" });
                        logCoreAdmin.writeLog(`已删除共享文件:${json.name}`);
                        respone.writeHead(200).end();
                        break
                    case "REFRESHPUBLICFILESLIST"://刷新共享文件(用户端 后台为每次进入实时更新)
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`请求更新公开文件列表时鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "ACTION_REFRESHPUBLICFILE" });
                        logCoreAdmin.writeInfo("公开文件列表已更新");
                        respone.writeHead(200).end();
                        break
                    case "GETSTATISTICE"://获取统计信息
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取统计信息鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "REQUEST_STATISTICE" }, respone.socket);
                        logCoreAdmin.writeDebug("已返回服务器统计信息");
                        break
                    case "GETSHARES"://获取所有用户的分享
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取所有用户分享鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "REQUEST_USERSHARE" }, respone.socket);
                        logCoreAdmin.writeDebug("已返回所有用户分享");
                        break
                    case "GETNICKNAMEEXLIST"://获取待审核昵称修改请求
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取昵称审核列表鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "REQUEST_NICKNAMEEXAMINELIST" }, respone.socket);
                        logCoreAdmin.writeDebug("已返回昵称待审列表");
                        break
                    case "REMOVESHARE"://移除一个来自用户的分享
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`移除用户分享鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "ACTION_REMOVEUSERSHARE", data: json.file });
                        logCoreAdmin.writeLog(`已移除用户分享:${json.file.id}`);
                        respone.writeHead(200).end("OK");
                        break
                    case "GETACCOUNTS"://获取所有账户
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取所有账户鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "REQUEST_ACCOUNTS" }, respone.socket);
                        logCoreAdmin.writeDebug("已返回所有账户");
                        break
                    case "GETACCOUNTINFO"://获取账户信息
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取账户信息鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if(httpsServer===null) process.send({ signal: "REQUEST_ACCOUNTINFO", account: json.account }, respone.socket);
                        logCoreAdmin.writeDebug(`已返回账户信息:${json.account}`);
                        break
                    case "SETACCOUNTINFO"://修改账户信息
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`修改账户设置鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (json.key === undefined || json.value === undefined || json.account === undefined) {
                            logCoreAdmin.writeWarn("无效的更改用户配置参数");
                            return
                        }
                        process.send({ signal: "ACTION_SETACCOUNTINFO", key: json.key, value: json.value, account: json.account });
                        respone.writeHead(200).end("OK");
                        logCoreAdmin.writeInfo(`将账户"${json.account}"的设置"${json.key}"更改为:${json.value}`);
                        break
                    case "RESETUSERACCOUNTTOKEN"://重置账户Token(强制登出)
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`重置其他账户Token时鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "ACTION_RESETUSERTOKEN", account: json.account });
                        respone.writeHead(200).end();
                        logCoreAdmin.writeLog(`已重置账户"${json.account}"的登录Token`);
                        break
                    case "CREATEACCOUNT"://创建一个新账户
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`创建新账户鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (json.account == undefined || json.password == undefined || json.email == undefined) {
                            logCoreAdmin.writeWarn(`网页后台注册账户时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            request.writeHead(500).end();
                            return
                        }
                        if (json.account == "" || json.password == "" || json.email == "") {
                            logCoreAdmin.writeWarn(`网页后台注册账户时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            request.writeHead(500).end();
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "ACTION_CREATEACCOUNT", account: json.account, password: json.password, email: json.email }, respone.socket);
                        logCoreAdmin.writeInfo(`正在尝试创建账户:${json.account}`);
                        break
                    case "NICKNAMEEXAMINE"://昵称审核 通过或失败
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`审核昵称鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (json.account == undefined || json.agree == undefined || json.account == "") {
                            logCoreAdmin.writeWarn(`网页后台审核昵称时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            respone.writeHead(500).end();
                            return
                        }
                        process.send({ signal: "ACTION_NICKNAMEEXAMINE", agree: json.agree, account: json.account });
                        logCoreAdmin.writeInfo(`对账户"${json.account}"的昵称审核结果为:${json.agree === "true" ? "通过" : "拒绝"}`);
                        respone.writeHead(200).end();
                        break
                    case "GETPUBLICFILELIST"://获取共享文件列表
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取公开文件列表鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        responePublicFileList(respone);
                        logCoreAdmin.writeDebug(`已返回公开文件列表`);
                        break
                    case "RENAMEPUBLICFILE"://重命名共享文件
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`重命名公开文件鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (json.file == undefined || json.newName == undefined || json.file == "" || json.newName == "") {
                            logCoreAdmin.writeWarn(`网页后台重命名公开文件时传入无效参数 IP:${getRequestIpAddress(request)}`);
                            respone.writeHead(500).end();
                            return
                        }
                        if (!await fs.exists(`./_publicFiles/${json.file}`)) {
                            logCoreAdmin.writeWarn(`尝试重命名不存在的公开文件 IP:${getRequestIpAddress(request)}`);
                            respone.writeHead(404).end();
                            return
                        }
                        if (process.platform === "win32") {
                            if (windowsFilterName.has(json.newName.slice(0, json.newName.indexOf(".") === -1 ? json.newName.length : json.newName.indexOf(".")).toUpperCase())) {
                                respone.writeHead(500).end();
                                logCoreAdmin.writeWarn(`新文件名含有Windows系统文件名保留字:${json.newName}`);
                                return
                            }
                        }
                        await fs.rename(`./_publicFiles/${json.file}`, `./_publicFiles/${json.newName}`);
                        respone.writeHead(200).end();
                        logCoreAdmin.writeLog(`已将公开文件"${json.file}"重命名为:${json.newName}`);
                        process.send({ signal: "ACTION_REFRESHPUBLICFILE" });
                        break
                    case "UPLOADPUBLICFILE"://预备在共享区上传文件
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`上传公开文件前请求鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (json.name == undefined || json.name == "") {
                            respone.writeHead(200).end("invArg");
                            logCoreAdmin.writeWarn(`上传公开文件请求含有无效参数 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        //检测文件重名
                        if ((await fs.readdir(`./_publicFiles/`)).includes(json.name)) {
                            respone.writeHead(200).end("repeat");
                            logCoreAdmin.writeLog(`准备上传的公开文件与现有文件重名:${json.name}`);
                            return
                        }
                        /* 你都会弄Node了还不知道Windows保留的文件名吗
                        懒得写过滤 */
                        /* 2023-8-7 写了罢*/
                        if (process.platform === "win32") {
                            if (windowsFilterName.has(json.name.slice(0, json.name.indexOf(".") === -1 ? json.name.length : json.name.indexOf(".")).toUpperCase())) {
                                respone.writeHead(200).end("win");
                                logCoreAdmin.writeWarn(`准备上传的公开文件含有Windows系统文件名保留字:${json.name}`);
                                return
                            }
                        }
                        try {
                            publicFileUploadPipe = fs.createWriteStream(`./_publicFiles/${json.name}`, { encoding: 'hex' });
                        } catch (error) {
                            respone.writeHead(200).end("exception");
                            logCoreAdmin.writeError(`上传公开文件时发生异常:${error.stack}`);
                            return
                        }
                        respone.writeHead(200).end("ok");
                        logCoreAdmin.writeDebug(`准备接收公开文件上传:${json.name}`);
                        break
                    case "GETBANIP":
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取封禁IP列表鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "REQUEST_GETBANIP" }, respone.socket);
                        logCoreAdmin.writeDebug(`已返回封禁IP列表`);
                        break
                    case "ADDBANIP":
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取封禁IP列表鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        if (httpsServer===null) process.send({ signal: "ADDBANIP", ip: json.data }, respone.socket);
                        logCoreAdmin.writeLog(`操作封禁IP:${json.data}`);
                        break
                    case "REMOVEBANIP":
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`获取封禁IP列表鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        process.send({ signal: "REMOVEBANIP", ip: json.ip });
                        respone.writeHead(200).end();
                        break
                    case undefined://为空时触发
                    case null:
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`收到空Action且鉴权失败Action IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        logCoreAdmin.writeWarn(`收到空Action IP:${getRequestIpAddress(request)}`);
                        respone.writeHead(200).end("Error on reference 'Action'");
                        break
                    default://未知指令
                        logCoreAdmin.writeLog(`Unknown action:${json.action}`);
                        if (!authentication(request)) {
                            request.destroy();
                            logCoreAdmin.writeWarn(`收到未知Action且鉴权失败 IP:${getRequestIpAddress(request)}`);
                            return
                        }
                        logCoreAdmin.writeWarn(`收到未知Action IP:${getRequestIpAddress(request)}`);
                        respone.writeHead(501).end("Unknown action");
                        break;
                }
            })
        } else if (request.headers["content-type"] === "application/x-www-form-urlencoded") {
            if (!authentication(request)) {
                request.destroy();
                logCoreAdmin.writeWarn(`上传文件数据鉴权失败 IP:${getRequestIpAddress(request)}`);
                return
            }
            if (publicFileUploadPipe == null && publicFileUploadPipe.closed) {//检查写入流是否正常
                request.writeHead(200).end("Stream error");
                logCoreAdmin.writeWarn(`写入上传文件前检查出现异常:输出流未创建或已关闭`);
                publicFileUploadPipe.destroy();
                return
            }
            request.on("data", (data) => {
                publicFileUploadPipe.write(data);
            })
            publicFileUploadPipe.on("error", (err) => {
                fs.remove(publicFileUploadPipe.path);
                logCoreAdmin.writeWarn(`写入文件时发生异常\n文件:${publicFileUploadPipe.path}\n详情:${error.stack}`);
            })
            request.on("end", () => {
                publicFileUploadPipe.end();
                logCoreAdmin.writeLog(`文件"${publicFileUploadPipe.path}"上传完成`);
                respone.writeHead(200).end();
            })
        } else {
            respone.destroy();
            logCoreAdmin.writeWarn(`Unsupport content-type:${request.headers["content-type"]}`);
        }
    }
}
function loginNotGUI(parsedUrl, respone, request) {
    if (authentication(request)) {//有cookie访问直接进页面
        respone.writeHead(301, "Redirect", { location: "/manager.wpgi" }).end();
        return
    }
    if ((parsedUrl.key || "").toString() === loginKey) {//判断密钥
        respone.setHeader("Set-Cookie", [`adminToken=${token}`]);
        respone.writeHead(301, "Redirect", { location: "/manager.wpgi" }).end();
        logCoreAdmin.writeInfo(`管理员登录成功\nIP:${getRequestIpAddress(request)}\nUA:${request.headers["user-agent"]}`);
        return
    }
    provisionalBanip.addCount(getRequestIpAddress(request));
    logCoreAdmin.writeInfo(`管理员登录失败:密码错误\nIP:${getRequestIpAddress(request)}\nUA:${request.headers["user-agent"]}`);
    request.destroy();
}
function adminDownloadShare(parsedUrl, request, respone) {
    const tempFilePath = `${serverConfig.storagePath}${parsedUrl.account}/${parsedUrl.name}`;
    if (fs.existsSync(tempFilePath)) {
        respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI(parsedUrl.name.toString())}"` });
        fs.createReadStream(tempFilePath).pipe(respone);
        logCoreAdmin.writeVerbose(`下载用户分享的文件:${tempFilePath}`);
        return
    }
    logCoreAdmin.writeWarn(`找不到要下载的文件:${tempFilePath}\nIP:${getRequestIpAddress(request)}`);
    respone.writeHead(404).end("File not found");
}
function adminDownloadUserLog(parsedUrl, request, respone) {
    if (!fs.existsSync(`./_logs/user_logs/${parsedUrl.account}.log`)) {
        respone.writeHead(404, "", { "Content-Type": "text/html;charset=utf-8" }).end("当前账户未产生日志文件或已被删除(File Not Found)");
        return
    }
    respone.writeHead(200, "", { "Content-Type": "application/x-www-form-urlencoded", "Content-Disposition": `attachment; filename="${encodeURI(parsedUrl.account.toString())}.log"` });
    fs.createReadStream(`./_logs/user_logs/${parsedUrl.account}.log`).pipe(respone);
    logCoreAdmin.writeLog(`下载用户"${parsedUrl.account}"的日志`);
}
function responeConfig() {
    return {
        debug: serverConfig.debug, enableHTTPS: serverConfig.enableHTTPS,
        enableShare: serverConfig.enableShare, enableRegister: serverConfig.enableRegister,
        enabledStreamMedia: serverConfig.enabledStreamMedia, enableNickName: serverConfig.enableNickName, changeNicknameExamine: serverConfig.changeNicknameExamine,
        mailerConfig: serverConfig.mailerConfig,limitRegisterEveryday:serverConfig.limitRegisterEveryday,enableResetPassword:serverConfig.enableResetPassword,
        registerVerify:serverConfig.registerVerify
    }
}
function authentication(request) {
    const tempCookie = cookie.parse(request.headers?.cookie || "");
    return (tempCookie.adminToken || "").toString() === token
}
function getRequestIpAddress(request) {
    return ((request.headers['x-forwarded-for'] || '').split(',').pop().trim() || request.connection?.remoteAddress || request.socket?.remoteAddress || request.connection?.socket?.remoteAddress) || "获取失败";
}
async function responePublicFileList(respone) {
    const finalList = [];
    const fileList = await fs.readdir("./_publicFiles/");
    for (let filePath of fileList) {
        let sameSize = (await fs.stat(`./_publicFiles/${filePath}`)).size;
        finalList.push({
            name: filePath,
            size: sameSize
        })
    }
    respone.writeHead(200, "", { "Content-Type": "application/json" }).end(JSON.stringify(finalList));
}
if (serverConfig.enableHTTPS) {
    try {
        httpsServer = https.createServer({ key: fs.readFileSync("./assets/https/server.key"), cert: fs.readFileSync("./assets/https/server.crt") }, requestCallback);
        httpsServer.listen(port, "0.0.0.0", () => {
            logCoreAdmin.writeInfo(`Background server listening port:${port}(HTTPS)`);
            process.send({signal:"LAUNCHER_POLLING_CONFIG_WEBSOCKET"})//让启动器轮询并发送开启ws信号
        })
    } catch (error) {
        if (error.message.toString().includes("no such file or directory")) {
            logCoreAdmin.writeError("Can not find HTTPS cert files.HTTPS background server start failed");

        } else {
            logCoreAdmin.writeError(`Failed to start HTTPS background server:\n${error.stack}`);
        }
        httpServer = http.createServer(requestCallback);
        httpServer.listen(port, "0.0.0.0", () => {
            logCoreAdmin.writeInfo(`Backguound server listening port:${port}(HTTP)`);
        });
    }
} else {
    httpServer = http.createServer(requestCallback);
    httpServer.listen(port, "0.0.0.0", () => {
        logCoreAdmin.writeInfo(`Backguound server listening port:${port}(HTTP)`);
    });
}

function onServerClose() {
    logCoreAdmin.writeLog("Admin background server close");
}
process.on("SIGINT", () => { });//防止直接被关
process.on("message", async (value) => {
    switch (value.signal) {
        case "CONFIG_UPDATE":
            serverConfig=value.data;
            logCoreAdmin.writeDebug("后台已重载配置");
            break
        case "ADMIN_SHUTDOWN"://Ctrl+C关服
            logCoreAdmin.closeWebSocket();
            httpsServer !== null ? httpsServer.close(onServerClose) : httpServer.close(onServerClose);
            process.exit(0);
        case "RESPONE_SERVERSTATE"://返回服务器状态
            serverState = value.data;
            break
        default://未知信号
            logCoreAdmin.writeWarn(`Unknown signal:${value.signal}`)
    }
})
process.on("uncaughtException", exception => {
    logCoreAdmin.writeError(`发生未捕获的异常:\n${exception.stack}`);
})