const fs = require("fs-extra");
const { resolve } = require("path");
const cookie = require("cookie");
const ws = require("ws").Server;
const os = require("os");

const https = require("https")
let WebSocket;
let hasConnected = false;//阻止多个连接
let postMemInfo = false;
module.exports = class logCore {
    constructor(logPath = __dirname, debuging = false, maxArrayLength = 256, wsPort = 25000, wsKey = "", useHttps = false) {
        if (useHttps) {
            let wss;
            try {
                wss = https.createServer({ key: fs.readFileSync("./assets/https/server.key"), cert: fs.readFileSync("./assets/https/server.crt") }, (req, res) => {
                    req.destroy();
                    res.destroy();
                }).listen(wsPort);
                WebSocket = new ws({ server: wss });
            } catch (error) {
                logCore.writeError("启动配置Websocket失败:" + error.stack);
            }
        }else{
            WebSocket = new ws({ port: wsPort});
        }
        this.logStream = fs.createWriteStream(resolve(logPath), { encoding: 'utf-8', flags: "a" });
        this._maxLogArrayLength = maxArrayLength;
        this.logArray = [];
        this.proxyLogArray = this.appendLogArray;
        this.writeDebug = debuging ? async (str) => { this.writeVerbose(str) } : async () => { };//调试日志
        fs.ensureDir(`${process.cwd()}/_logs/user_logs/`);//用户个人日志文件夹
        WebSocket.on("connection", (socket, request) => {
            let wsJson;
            if ((cookie.parse(request.headers.cookie || "")).wsKey === wsKey && !hasConnected) {
                this.writeInfo(`日志WebSocket已连接 IP:${this.getRequestIpAddress(request)}`);
                hasConnected = true;
                this.proxyLogArray = new Proxy(this.appendLogArray, {
                    apply: (target, context, args) => {
                        socket.send(JSON.stringify({ action: "update", data: args }));
                        this.appendLogArray(args[0], args[1]);
                    }
                })
            } else {
                this.writeWarn(`WebSocket连接验证失败或已有连接 IP:${this.getRequestIpAddress(request)}`);
                socket.close();
            }
            socket.on("message", data => {
                try {
                    wsJson = JSON.parse(data.toString());
                } catch (error) {
                    this.writeError("Failed to parse data object");
                    socket.close();
                }
                switch (wsJson.action) {
                    case "getAllLogs":
                        socket.send(JSON.stringify({ action: "resp_allLog", data: this.logArray }));
                        break
                    case "postMemInfo":
                        socket.send(JSON.stringify({ action: "memInit", totalMem: os.totalmem() }));
                        postMemInfo = true;
                        this.sendMemInfo(socket);
                        break
                    default:
                        this.writeWarn(`未知WebSocket指令:${data.action}`);
                        socket.close();
                }
            });
            socket.on("close", () => {
                if (WebSocket.clients.size <= 0) {
                    this.writeInfo("日志WebSocket连接已关闭");
                    this.proxyLogArray = this.appendLogArray;
                    hasConnected = false;
                }
            })
        })
    }
    async sendMemInfo(socket) {
        setInterval(() => {
            if (WebSocket.clients.size > 0 && postMemInfo) {
                socket.send(JSON.stringify({ action: "memInfo", free: os.freemem() }));
            }
        }, 1050);
    }
    async writeLog(str) {
        const logStr = `{${new Date().toLocaleString()}} [LOG]: ${str.toString()}`;
        this.logStream.write(logStr + "\n");
        console.log(logStr);
        this.proxyLogArray("BLACK", logStr);
    }
    async writeWarn(str) {
        const logStr = `{${new Date().toLocaleString()}} [WARN]: ${str.toString()}`;
        this.logStream.write(logStr + "\n");
        console.log("\x1B[33m" + logStr + "\x1b[0m");
        this.proxyLogArray("YELLOW", logStr);
    }
    async writeError(str) {
        const logStr = `{${new Date().toLocaleString()}} [ERROR]: ${str.toString()}`;
        this.logStream.write(logStr + "\n");
        console.log("\x1B[31m" + logStr + "\x1b[0m");
        this.proxyLogArray("RED", logStr);
    }
    async writeInfo(str) {//染成绿的
        const logStr = `{${new Date().toLocaleString()}} [INFO]: ${str.toString()}`;
        this.logStream.write(logStr + "\n");
        console.log("\x1B[32m" + logStr + "\x1b[0m");
        this.proxyLogArray("GREEN", logStr);
    }
    async writeVerbose(str) {
        const logStr = `{${new Date().toLocaleString()}} [VERBOSE]: ${str.toString()}`;
        this.logStream.write(logStr + "\n");
        console.log("\x1B[90m" + logStr + "\x1b[0m");
        this.proxyLogArray("GRAY", logStr);
    }
    async writeAccountLog(account = "未知用户名", str = "") {
        const logStr = `{${new Date().toLocaleString()}}:${str}\n`;
        fs.appendFile(`${process.cwd()}/_logs/user_logs/${account}.log`, logStr);
    }
    async appendLogArray(color = "BLACK", str) {
        if (this.logArray.length >= this._maxLogArrayLength) this.logArray = [];
        this.logArray.push({
            color: color,
            text: str
        });
    }
    getRequestIpAddress(request) {
        return ((request.headers['x-forwarded-for'] || '').split(',').pop().trim() || request.connection?.remoteAddress || request.socket?.remoteAddress || request.connection?.socket?.remoteAddress) || null;
    }
    closeWebSocket() {//关闭ws和写出流
        WebSocket.close();
        WebSocket = null;
        this.logStream.close();
    }
}