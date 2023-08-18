const ChildProcess = require("child_process");
//检查及安装node_modules
const {existsSync}=require("fs");
if (!existsSync("./node_modules/")) {
    console.log("正在安装node_modules...\n这可能需要几分钟时间\n请勿关闭本窗口");
    ChildProcess.execSync("npm config set registry http://registry.npm.taobao.org/");
    ChildProcess.execSync("npm install --omit=dev");
    console.log("安装完成");
}
const fs = require("fs-extra");
const { sleep, spawnRandomKey } = require("./modules/coreInit");
let diskServerProcess, adminBackgroundServerProcess;
let shutdowning = false;
let enabledConfigSocket=false;
let configObj = {
    debug: false,
    storagePath: "./_diskStorage/",
    enabledWebBackground: true,
    enableHTTPS: false,
    maxLogArrayLength: 256,
    portForHTTPS: 1524,
    registerVerify: false,
    defaultNewUserStorage:128,
    randomBackgroundPort: false,
    backgroundPort: 8650,
    backgroundLoginGUI: true,
    backgroundRandomKey: false,
    backgroundLoginKey: "adminLogin",
    onlyLocalhostBackground: false,
    autoSaveTimer: 1800000,
    enableShare: true,
    enableRegister: true,
    enabledStreamMedia: true,
    enableNickName: true,
    changeNicknameExamine: false,
    enableResetPassword: false,
    deletedFilesBackup:false,
    enableBanipTips: true,
    banipTipsText: "IP banned",
    autoProvisionalBanip:false,
    provisionalBanipTime:300000,
    limitRegisterEveryday:false,
    maxEverydayRigister:16,
    loginFailedLimitTime:300000,
    mailerConfig: {
        email: null,
        pass: null,
        host: null,
        port: null
    }
}
//拉起子进程并传入相同密钥
checkConfigFile().then((config) => {
    diskServerProcess = ChildProcess.fork("./diskServer.js", [spawnRandomKey()]);
    adminBackgroundServerProcess = config.enabledWebBackground ? ChildProcess.fork("./modules/background/admin.js", [spawnRandomKey()]) : {
        send: () => { },
        kill: () => { },
        on: () => { },
        exitCode: 0
    }
    console.log("Launcher: Child processes launched.");
    initDiskProcessMessage();
    initAdminBackground();
})
let serverStateText = "Running";//服务器状态文字 用于前端显示
let titleAnimationInterrupt = true
createTitleLooper();
function initDiskProcessMessage() {
    diskServerProcess.on("message", value => {
        switch (value.signal) {
            case "CLOSED"://后台关服
                console.log("Server closed by background");
                serverStateText = "Closed";
                break
            case "START_FAILED":
                console.log("服务器启动失败");
                adminBackgroundServerProcess.kill();
                process.exit(1);
            case "COMMAND_SHUTDOWN":
                if (!shutdowning) {
                    shutdowning=true;
                    singalShutdown(value.closeAllConnections);
                }
                break
            default:
                adminBackgroundServerProcess.send(value);
        }
    })
}

function initAdminBackground() {
    adminBackgroundServerProcess.on("message", (value,socket) => {
        switch (value.signal) {
            case "BOOT"://启动
                diskServerProcess = ChildProcess.fork("./diskServer.js", [spawnRandomKey()]);
                initDiskProcessMessage();
                serverStateText = "Running";
                if (enabledConfigSocket) {
                    const configWsPolling=setInterval(() => {
                        if (diskServerProcess!=null) {
                            clearInterval(configWsPolling);
                            setTimeout(() => {
                                diskServerProcess.send({signal:"SETUP_WEBBG_SOCKET"});
                            }, 150);
                        }
                    }, 250);
                }
                //开启服务器 在此操作
                break;
            case "REQUEST_SERVERSTATE"://返回状态时添加exitCode
                adminBackgroundServerProcess.send({
                    signal: "RESPONE_SERVERSTATE", data: {
                        running: diskServerProcess.exitCode === null
                    }
                });
                break
            case "REQUEST_STATISTICE"://依情况修改统计信息返回值
                if (diskServerProcess.exitCode === null) {
                    diskServerProcess.send({ signal: "REQUEST_STATISTICE" },socket);
                    return
                };
                //如果服务器已关闭则不获取信息
                //直接发送
                socket.write(`HTTP/1.1 200\r\nContent-Type: application/json\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nContent-Length: 183\r\n\r\n{"download":"无法获取","loginCount":"无法获取","newShare":"无法获取","register":"无法获取","serverState":"Closed","streamMedia":"无法获取","upload":"无法获取"}`);
                socket.end();
                break
            case "SHUTDOWN"://关服
                if (diskServerProcess.exitCode !== null) {
                    console.log(`Send signal on process stoped:${value.signal}`);
                    return
                }
                serverStateText = "Shutdowning";
                diskServerProcess.send({ signal: "SHUTDOWN", sendSignal: true });
                break
            case "LAUNCHER_POLLING_CONFIG_WEBSOCKET"://轮询开启配置ws
                enabledConfigSocket=true;
                const configWsPolling=setInterval(() => {
                    if (diskServerProcess!=null) {
                        clearInterval(configWsPolling);
                        setTimeout(() => {
                            diskServerProcess.send({signal:"SETUP_WEBBG_SOCKET"});
                        }, 150);
                    }
                }, 250);
                break
            default://其他信号直接转发
                //防止进程停止还转发信号
                if (diskServerProcess.exitCode !== null) {
                    console.log(`Send signal on process stoped:${value.signal}`);
                    return
                }
                //转发给服务器进程
                diskServerProcess.send(value,socket);
                break;
        }
    });
}
process.once("SIGINT", () => {//Ctrl+C
    if (!shutdowning) { 
        singalShutdown();
        shutdowning = true;
    }
});
async function singalShutdown(closeConnections = "true") {
    console.log("Shutdowning");
    titleAnimationInterrupt = false;//清除标题动画
    process.title = "Shutdowning...";
    if (adminBackgroundServerProcess.exitCode===null) {
        adminBackgroundServerProcess.send({ signal: "ADMIN_SHUTDOWN", sendSignal: false });
    }else{
        console.log("网页后台服务器进程未运行");
    }
    if (diskServerProcess.exitCode === null) diskServerProcess.send({ signal: "SHUTDOWN", closeAllConnections: closeConnections });
    const shutdownPolling = setInterval(() => {//轮询进程状态
        if (diskServerProcess.exitCode !== null && adminBackgroundServerProcess.exitCode !== null) {
            console.log("Server shutdown");
            clearInterval(shutdownPolling);
            process.title = "Shutdown";
            process.exit(0);
        }
    }, 200);
}
async function checkConfigFile() {
    try {
        if (await fs.exists("./config.json")) {
            const configFile = await fs.readJson("./config.json");
            const configKeys = Object.keys(configFile);
            if (configKeys.length !== 30) {
                await fs.writeJSON("./config.json", configObj);
                console.log("配置文件异常 已重新创建");
                return configObj
            }
            const HasKeys = ["debug", "enableHTTPS", "enabledWebBackground", "autoSaveTimer", "enableShare", "enableRegister", "enabledStreamMedia", "enableNickName"
                , "randomBackgroundPort", "backgroundPort", "backgroundLoginGUI", "backgroundLoginKey", "backgroundRandomKey", "storagePath",
                "changeNicknameExamine", "maxLogArrayLength", "mailerConfig", "onlyLocalhostBackground", "registerVerify", "autoProvisionalBanip", "provisionalBanipTime","defaultNewUserStorage",
            "limitRegisterEveryday","maxEverydayRigister","loginFailedLimitTime","banipTipsText","enableBanipTips"];
            if (HasKeys.some(value => {
                return !configKeys.includes(value);
            })) {
                await fs.writeJSON("./config.json", configObj);
                console.log("配置文件异常 已重新创建");
                return configObj;
            };
            await fs.ensureDir(configFile.storagePath);
            return configFile
        } else {
            await fs.writeJSON("./config.json", configObj);
            console.log("未找到配置文件(config.json) 已重新创建");
            return configObj
        }
    } catch (error) {
        console.log("载入配置文件时发生异常 请检查其是否损坏\n可删除该文件并重新打开本程序 文件将重新生成\n文件名:config.json");
        process.exit(1);
    }
}
async function createTitleLooper() {//标题栏动画 Windows下测试
    let counter = 0;
    const titleFrame1 = "| Web Disk Server |";
    const titleFrame2 = "/ Web Disk Server /";
    const titleFrame3 = "−Web Disk Server−";
    const titleFrame4 = "\\ Web Disk Server \\";
    const titleFrame5 = "  Web Disk Server  ";
    // 循环数组
    const titleAnimation = [titleFrame1, titleFrame2, titleFrame3, titleFrame4, titleFrame1, titleFrame5, titleFrame1, titleFrame5, titleFrame1, titleFrame5];
    while (titleAnimationInterrupt) {
        process.title = titleAnimation[counter];
        if (++counter >= titleAnimation.length) counter = 0;
        await sleep(350);
    }
}
