let htmlButtonTrue, htmlButtonFalse, accountEditWindow;
/**
 * @description 配置Websocket实例
 * @export configWs
 * @type {WebSocket}
 */
let configWs = null;
let enableNotification = false;
const emailReg = new RegExp("^[a-zA-Z0-9]+([-_.][A-Za-zd]+)*@([a-zA-Z0-9]+[-.])+[A-Za-zd]{2,5}$");
const ipReg = /(\d{1,3}\.){3}\d{1,3}/;
const initedPage = [true, false, false, false, false, false, false];//进入标签页才初始化 降低服务器压力
/* 0:首页 自动初始化
 1:分享管理页
 2:账户管理
 3:昵称审核
 4:banIP
 5:日志*/
//所有开关元素
const htmlSwitchElem = [document.getElementById("config_debug"), document.getElementById("config_enableHTTPS"), document.getElementById("config_enbaleShare"), document.getElementById("config_enableRegister"),
document.getElementById("config_registerVerify"), document.getElementById("config_enableStreamMedia"), document.getElementById("config_enableNickname"), document.getElementById("config_changeNicknameExamine"), document.getElementById("config_enableResetPassword"),
document.getElementById("config_limitRegisterEveryday")];
let serverConfigObj = null;
(async function () { //初始化
    initEnter();
    if (location.protocol.toLowerCase() === "https:") {
        initConfigSocket();
    } else {
        initStatistics();
    }
    htmlButtonFalse = window.URL.createObjectURL((await (await fetch("bitmap_html_switch_false.bitmap", {
        responseType: "blob"
    })).blob()));
    htmlButtonTrue = window.URL.createObjectURL((await (await fetch("bitmap_html_switch_true.bitmap", {
        responseType: "blob"
    })).blob()));
    serverConfigObj = await (await fetch("/", { credentials: "include", method: "POST", body: JSON.stringify({ action: "GETCONFIG" }), headers: { 'Content-Type': 'application/json' } })).json();
    if (serverConfigObj === null) {
        alert("获取配置信息失败");
        return
    }
    const switchState = [serverConfigObj.debug, serverConfigObj.enableHTTPS, serverConfigObj.enableShare, serverConfigObj.enableRegister, serverConfigObj.registerVerify, serverConfigObj.enabledStreamMedia, serverConfigObj.enableNickName, serverConfigObj.changeNicknameExamine, serverConfigObj.enableResetPassword, serverConfigObj.limitRegisterEveryday];
    //初始化
    for (let elem in htmlSwitchElem) {
        htmlSwitchElem[elem].src = switchState[elem] ? htmlButtonTrue : htmlButtonFalse;
        htmlSwitchElem[elem].checked = switchState[elem];
    }
    try {
        Notification.requestPermission();
    } catch (error) { }
})();
const menuElement = [document.getElementById("menu_baseInfo"), document.getElementById("menu_shareManager"), document
    .getElementById("menu_accountSafe"), document.getElementById("menu_nickname"), document.getElementById("menu_publicFile"), document.getElementById("menu_banip"), document.getElementById("menu_logs")
];
const menuDivElement = [document.getElementById("controlDiv"), document.getElementById("shareManagerDiv"), document.getElementById("accountManagerDiv"),
document.getElementById("nicknameDiv"), document.getElementById("publicFileDiv"), document.getElementById("banipDiv"), document.getElementById("logDiv")
];
async function initStatistics(data = null) {//统计信息初始化
    //https下不传参调用会操作ws
    if (location.protocol.toLowerCase() === "https:" && data === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "GETSTATISTICE" }));
        return
    }
    const statisticsResp = data === null ? await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETSTATISTICE" }) })).json() : data
    if (statisticsResp == null && data === null) {
        alert("获取信息失败");
        return
    }
    document.getElementById("text_loginCount").innerText = `登录数量:${statisticsResp.loginCount}`;
    document.getElementById("text_uplaodFile").innerText = `上传文件:${statisticsResp.upload}`;
    document.getElementById("text_downloadFile").innerText = `下载文件:${statisticsResp.download}`;
    document.getElementById("text_streamMedia").innerText = `流媒体播放:${statisticsResp.streamMedia}`;
    document.getElementById("text_newShare").innerText = `新增分享:${statisticsResp.newShare}`;
    document.getElementById("text_reg").innerText = `新增注册:${statisticsResp.register}`;
    let serverStateElem = document.getElementById("serverStateText");
    switch (statisticsResp.serverState) {
        case "Running":
            serverStateElem.innerHTML = '<a id="serverStateText" style="color:green;">运行中</a>';
            break;
        case "Shutdowning":
            serverStateElem.innerHTML = '<a id="serverStateText" style="color:yellow;">正在关闭</a>';
            break
        case "Closed":
            serverStateElem.innerHTML = '<a id="serverStateText" style="color:red;">已关闭</a>';
            break
        default:
            serverStateElem.innerHTML = '<a id="serverStateText" style="color:gray;">未知</a>'
            break;
    }
}
async function initUserShares(data = null) {//初始化所有分享列表
    const table = document.getElementById("userShareTable");
    table.innerHTML = `<tbody><tr><td>文件名<hr/></td><td>分享者用户名<hr/></td><td>操作<hr/></td></tr></tbody>`;
    if (location.protocol.toLowerCase() === "https:" && data === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "GETSHARES" }));
        return
    }
    const shareListResp = data === null ? await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETSHARES" }) })).json() : data;
    document.getElementById("shareListRequingText").hidden = true;
    const finalList = [];
    const shareKeys = Object.keys(shareListResp);
    for (let key of shareKeys) {
        finalList.push({
            id: key,
            name: shareListResp[key].file,
            sharer: shareListResp[key].account
        })
    }
    for (let i = 0; i < finalList.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.fileInfo = finalList[i];//打入文件id用于下载
        newRow.innerHTML = `<a href="javascript:void(0)" onclick="downloadUserShare(this.parentNode.fileInfo)">${finalList[i].name}</a><hr/>`;
        let newCell1 = newRow.insertCell(0);
        newCell1.innerHTML = `<a>${finalList[i].sharer}</a><hr/>`;
        let newCell2 = newRow.insertCell(1);
        newCell2.innerHTML = `<button class="share_remove" onclick="removeUserShare(this.parentNode.parentNode.fileInfo)">移除分享</button><hr/>`;
    }
    if (finalList.length === 0) alert("列表为空")
}
async function initAccountListTable(data = null) {
    const table = document.getElementById("accountTable");
    table.innerHTML = `<tbody><tr><td>昵称<hr/></td><td>用户名<hr/></td><td>操作<hr/></td></tr></tbody>`;
    if (location.protocol.toLowerCase() === "https:" && data === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "GETACCOUNTS" }));
        return
    }
    const accountListResp = data === null ? await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETACCOUNTS" }) })).json() : data;
    document.getElementById("accountListRequingText").hidden = true;
    const finalList = [];
    const accountKeys = Object.keys(accountListResp);
    for (let key of accountKeys) {
        finalList.push(Object.assign(accountListResp[key], { userName: key }))
    }
    for (let i = 0; i < finalList.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.data = finalList[i];
        newRow.innerHTML = `<a${finalList[i].enabled ? '' : ' class="text_red"'}>${finalList[i].nickName}</a><hr/>`;
        let newCell1 = newRow.insertCell(0);
        newCell1.innerHTML = `<a${finalList[i].enabled ? '' : ' class="text_red"'}>${finalList[i].userName}</a><hr/>`;
        let newCell2 = newRow.insertCell(1);
        newCell2.innerHTML = `<button class="account_info" onclick="openAccountInfoWindow(this.parentNode.parentNode.data)">详情</button><button class="downloadUserLogButton" onclick="downloadUserLog(this.parentNode.parentNode.childNodes[2].childNodes[0].innerText)">下载日志</button><hr/>`;
    }
    if (finalList.length === 0) alert("列表为空")
}
async function initNicknameExamineTable(data = null) {
    const table = document.getElementById("nickname_table");
    table.innerHTML = `<tbody><tr><td>原昵称<hr/></td><td>新昵称<hr/></td><td>操作<hr/></td></tr></tbody>`;
    if (location.protocol.toLowerCase() === "https:" && data === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "GETNICKNAMEEXLIST" }));
        return
    }
    const nicknameListResp = data === null ? await (await fetch("", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETNICKNAMEEXLIST" }) })).json() : data;
    document.getElementById("nicknameLoadingText").hidden = true;
    const finalList = [];
    const respKeys = Object.keys(nicknameListResp);
    for (let key of respKeys) {
        finalList.push(Object.assign(nicknameListResp[key], { account: key }))
    }
    for (let i = 0; i < finalList.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.data = finalList[i];
        newRow.innerHTML = `<a>${finalList[i].oldName}</a><hr/>`;
        let newCell1 = newRow.insertCell(0);
        newCell1.innerHTML = `<a>${finalList[i].newName}</a><hr/>`;
        let newCell2 = newRow.insertCell(1);
        newCell2.innerHTML = `<button onclick="nicknameExamine(true,this.parentNode.parentNode)" class="nickname_agree">通过</button><button onclick="nicknameExamine(false,this.parentNode.parentNode)" class="nickname_reject">拒绝</button><hr/>`;
    }
    if (finalList.length === 0) alert("列表为空")
}
async function initPublicFiles() {
    const table = document.getElementById("publicFilesTable");
    table.innerHTML = `<tbody><tr><td>文件名<hr/></td><td>大小<hr/></td><td>操作<hr/></td></tr></tbody>`;
    const publicFileResp = await (await fetch("", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETPUBLICFILELIST" }) })).json();
    document.getElementById("publicFileLoadingText").hidden = true;
    for (let i = 0; i < publicFileResp.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.innerHTML = `<a>${publicFileResp[i].name}</a><hr/>`;
        let newCell1 = newRow.insertCell(0);
        newCell1.innerHTML = `<a>${byte2Mb(publicFileResp[i].size)}MB</a><hr/>`;
        let newCell2 = newRow.insertCell(1);
        newCell2.innerHTML = `<button onclick="deletePublicFile(this.parentElement.parentElement.children[0].innerText)" class="nickname_reject">删除</button><button onclick="document.getElementById('renamePublicFileDialog').show();document.getElementById('renamePublicFileDialog').fileName=this.parentNode.parentNode.children[0].innerText;document.getElementById('publicFile_newNameInput').value=this.parentNode.parentNode.children[0].innerText" class="button_blue">重命名</button><hr/>`;
    }
}
async function initBanip(data = null) {
    const table = document.getElementById("banipTable");
    table.innerHTML = `<tbody><tr><td>IP地址<hr/></td><td>操作<hr/></td></tr></tbody>`;
    if (location.protocol.toLowerCase() === "https:" && data === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "GETBANIP" }));
        return
    }
    const banipResp = data === null ? await (await fetch("", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "GETBANIP" }) })).json() : data;
    document.getElementById("banipLoadingText").hidden = true;
    for (let i = 0; i < banipResp.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.innerHTML = `<a>${banipResp[i]}</a><hr/>`;
        let newCell = newRow.insertCell(0);
        newCell.innerHTML = `<button onclick="removeBanip(this.parentElement.parentElement.children[0].innerText)" class="nickname_reject">删除</button><hr/>`;
    }
}
async function initConfigSocket() {
    configWs = new WebSocket(`wss://${location.hostname}:60127`);
    configWs.onerror = () => {
        try {
            initStatistics({ download: "无法获取", loginCount: "无法获取", newShare: "无法获取", register: "无法获取", serverState: "Closed", streamMedia: "无法获取", upload: "无法获取" });
            if (Notification.permission === "granted") {
                new Notification("无法连接配置管理服务", { requireInteraction: true, body: "将无法进行大多数配置 请按需开启前台服务端\n或检查服务端运行是否出现异常", silent: true, tag: "configConnectFaliled" });
            } else {
                alert("无法连接配置管理服务");
            }
        } catch (error) {
            alert("无法连接配置管理服务");
        }
    }
    configWs.onopen = async () => {
        //初始化
        configWs.send(JSON.stringify({ action: "GETSTATISTICE" }));
        //接收事件
        configWs.onmessage = async (messageEvent) => {
            const json = JSON.parse(messageEvent.data);
            switch (json.action) {
                case "VERIFY_FAILED":
                    alert("连接验证失败,请尝试重新登录后台");
                    window.location.href = "/";
                    break
                case "RESPONE_STATISTICE":
                    initStatistics(json.data);
                    break
                case "RESPONE_SHARE":
                    initUserShares(json.data);
                    break
                case "RESPONE_NICKNAMEEX":
                    initNicknameExamineTable(json.data);
                    break
                case "RESPONE_ACCOUNTS":
                    initAccountListTable(json.data);
                    break
                case "RESPONE_BANIP":
                    initBanip(json.data);
                    break
                case "RESPONE_ADDBANIP":
                    addBanip(null, { code: json.code });
                    break
                case "RESPONE_CREATEACCOUNT":
                    createNewAccount(json.data);
                    break
                case "RESPONE_ACCOUNTINFO":
                    if (accountEditWindow !== null) {
                        accountEditWindow.socketDataCallback(json);
                    }
                    break
                default:
                    alert(`意外的后端返回:${json.action}`);
            }
        }
    }
}
async function addBanip(ip, resp = null) {
    //回车 删除IP
    if (!ipReg.test(ip) && resp === null) {
        alert("输入不规范");
        return
    }
    if (location.protocol.toLowerCase() === "https:" && resp === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "ADDBANIP", data: ip }));
        return
    }
    const addBanipResp = resp === null ? await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "ADDBANIP", data: ip }) })).json() : resp;
    switch (addBanipResp.code) {
        case 0:
            alert("操作成功");
            document.getElementById("addBanipDialog").close();
            initBanip();
            break
        case 1:
            alert("重复添加IP");
            break
        case 2:
            alert("参数异常");
            break
        default:
            alert("未知返回");
    }

}
async function removeBanip(ip) {
    if (!confirm(`确认移除IP:${ip}`)) return
    await fetch("", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "REMOVEBANIP", ip: ip }) });
    alert("已执行");
    initBanip()
}
async function initLogWs() {
    document.getElementById("logFrame").contentWindow.init(`${window.location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:10492`, true);
}
function initEnter() {
    document.getElementById("newAccount_userNameInput").onkeydown = (key) => {
        if (key.keyCode === 13) {
            createNewAccount();
        }
    }
    document.getElementById("newAccount_passwordInput").onkeydown = (key) => {
        if (key.keyCode === 13) {
            createNewAccount();
        }
    }
    document.getElementById("newAccount_emailInput").onkeydown = (key) => {
        if (key.keyCode === 13) {
            createNewAccount();
        }
    }
    document.getElementById("publicFile_newNameInput").onkeydown = key => {
        if (key.keyCode === 13) {
            renamePublicFile(document.getElementById("renamePublicFileDialog").fileName, document.getElementById('publicFile_newNameInput').value.toString())
        }
    }
    document.getElementById("banip_ipInput").onkeydown = keyEvent => {
        if (keyEvent.key === "Enter") {
            addBanip(document.getElementById('banip_ipInput').value.toString());
        }
    }
}
async function changeConfig(type, elem, reload = true) {
    try {
        const setConfigResp = await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "SETCONFIG", config: type, value: !elem.checked, reload: reload }) })).text();
        if (setConfigResp == null || setConfigResp === "FAILED") {
            alert("修改配置失败");
            return
        }
    } catch (e) {
        alert("修改配置失败:" + e);
        return
    }
    swapHtmlSwitchState(elem);
}
async function uploadFileFunction() {
    const fileInputer = document.getElementById("uploadFrom");
    if (fileInputer.files.length > 1) { //不支持多文件
        alert("文件选择异常");
        return
    }
    if (fileInputer.files[0] == undefined) return
    fileInputer.disabled = true;
    let reader = new FileReader();
    reader.readAsArrayBuffer(fileInputer.files[0]);
    reader.onload = async () => {
        const inputBuffer = reader.result;
        const reqCreateStream = await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "UPLOADPUBLICFILE", name: fileInputer.files[0].name }) })).text();
        switch (reqCreateStream) {
            case "repeat"://重复文件名
                alert("文件名重复");
                fileInputer.disabled = false;
                return
            case "win":
                alert("文件名为服务端操作系统保留字");
                fileInputer.disabled = false;
                return
            case "invArg":
                alert("无效参数");
                fileInputer.disabled = false;
                return
            case "ok":
                break
            default:
                alert(`未知返回:${reqCreateStream}`);
                fileInputer.disabled = false;
                return
        }
        try {
            await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, method: "POST", body: inputBuffer });
        } catch (e) {
            alert("上传失败");
            fileInputer.disabled = false;
            return
        }
        alert("上传完成");
        initPublicFiles();
        fileInputer.disabled = false;
    }
}
async function resetToken() {
    if (!confirm("将退出后台登录并重置Token\n(日志WebSocket密钥及登录密码不变)")) return
    const resp = await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "RESETTOKEN" }) })).text();
    if (resp == null) {
        alert("请求发送失败");
        return
    }
    if (resp === "OK") {
        alert("重置完成");
        document.cookie = "adminToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
        document.cookie = "wsKey=; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
        window.location.href = "/";
        return
    }
    alert("发生异常");
}

async function createNewAccount(resp = null) {
    //不是处理ws返回数据时
    let accountInput, passwordInput, emailInput;
    if (resp === null) {
        accountInput = document.getElementById("newAccount_userNameInput").value.toString();
        passwordInput = document.getElementById("newAccount_passwordInput").value.toString();
        emailInput = document.getElementById("newAccount_emailInput").value.toString();
        if ([accountInput, passwordInput, emailInput].some(value => { return value.length <= 0 })) {
            alert("输入不能留空");
            return
        }
        //邮箱检测
        if (!emailReg.test(emailInput)) {
            alert("邮箱格式异常");
            return
        }
    }
    if (location.protocol.toLowerCase() === "https:" && resp === null && configWs !== null) {
        if (configWs.readyState !== 1) {
            alert("连接已断开");
            return
        }
        configWs.send(JSON.stringify({ action: "CREATEACCOUNT", data: { account: accountInput, password: passwordInput, email: emailInput } }));
        return
    }
    try {
        const createAccountResp = resp === null ? await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "CREATEACCOUNT", account: accountInput, password: passwordInput, email: emailInput }) })).json() : resp;
        switch (createAccountResp.code) {
            case 0:
                alert("操作成功");
                initAccountListTable();//刷新列表
                //清空输入
                document.getElementById("newAccount_userNameInput").value = "";
                document.getElementById("newAccount_passwordInput").value = "";
                document.getElementById("newAccount_emailInput").value = "custom@dev.com";
                //关闭弹窗
                document.getElementById('newAccountDialog').close();
                break
            case 1:
                alert("存在重复用户名");
                break
            case 2:
                alert("服务端拒绝该请求");
                break
        }
    } catch (error) {
        alert("请求失败");
        document.getElementById("newAccount_userNameInput").value = "";
        document.getElementById("newAccount_passwordInput").value = "";
        document.getElementById("newAccount_emailInput").value = "custom@dev.com";
        //关闭弹窗
        document.getElementById('newAccountDialog').close();
    }
}
async function setMailerConfig() {
    let fetchResp;
    const portValue = parseInt(document.getElementById("mailerConfig_port").value);
    // 检查端口输入是否合规
    if (isNaN(portValue) || portValue < 0 || portValue > 65535) {
        alert("端口设置不正确:必须是0-65535范围内数字");
        return
    }
    const emailValue = document.getElementById("mailerConfig_emailInput").value.toString();
    if (!emailReg.test(emailValue)) {
        alert("邮箱格式不正确");
        return
    }
    const passValue = document.getElementById("mailerConfig_passInput").value.toString();
    const hostValue = document.getElementById("mailerConfig_hostInput").value.toString();
    try {
        fetchResp = await fetch("/", { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "SETCONFIG", config: "mailerConfig", reload: true, value: { email: emailValue, pass: passValue, host: hostValue, port: portValue } }) });
    } catch (e) {
        alert("发送更改请求异常");
        return
    }
    if (fetchResp.status === 200) {
        alert("修改成功");
        document.getElementById("mailerConfigDialog").close();
        return
    }
    alert(`修改失败 状态码:${fetchResp.status}`);
}
function showEmailConfigDialog() {
    document.getElementById("mailerConfig_port").value = serverConfigObj.mailerConfig?.port?.toString() || "";
    document.getElementById("mailerConfig_emailInput").value = serverConfigObj.mailerConfig?.email?.toString() || "";
    document.getElementById("mailerConfig_passInput").value = serverConfigObj.mailerConfig?.pass?.toString() || "";
    document.getElementById("mailerConfig_hostInput").value = serverConfigObj.mailerConfig?.host?.toString() || "";
    document.getElementById('mailerConfigDialog').show();
}
async function nicknameExamine(allow = false, element) {
    /* allow:是否通过验证 */
    await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "NICKNAMEEXAMINE", agree: allow, account: element.data.account }) });
    alert("已执行");
    initNicknameExamineTable();
}
function downloadUserLog(account) {
    window.open(`/?action=downloadUserLog&account=${account}`);
}
async function shutdownServer() {
    if (!confirm("确定关闭服务器?\n再次开启前大部分操作将无法进行")) return
    const sdResp = await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "SHUTDOWN" }) })).text();
    switch (sdResp) {
        case "OK":
            alert("执行成功");
            window.location.reload();
            break;
        case "FAILED_CLOSED":
            alert("失败:服务器已经关闭");
            break;
        default:
            break;
    }
}
async function deletePublicFile(name) {
    if (!confirm(`确认删除:${name}?`)) return
    try {
        await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "DELETEPUBLICFILE", name: name }) });
    } catch (e) {
        alert("发生异常");
        initPublicFiles();
        return
    }
    alert("已执行");
    initPublicFiles();
}
async function renamePublicFile(file, newName) {
    const renameResp = await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "RENAMEPUBLICFILE", file: file, newName: newName }) });
    if (renameResp.status === 500) {
        alert("重命名失败 请查看服务器日志");
        return
    }
    alert("已执行");
    document.getElementById("renamePublicFileDialog").close();
    document.getElementById("publicFile_newNameInput").value = "";
    initPublicFiles();
}
async function reloadPublicFiles() {
    await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "REFRESHPUBLICFILESLIST" }) });
    alert("已执行");
    initPublicFiles();
}
function byte2Mb(bytes) {
    return parseFloat((bytes / 1024 / 1024).toFixed(2));
}
async function bootServer() {
    if (!confirm("确定开启服务器?")) return
    const btResp = await (await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "BOOT" }) })).text();
    switch (btResp) {
        case "OK":
            alert("执行成功");
            window.location.reload();
            break;
        case "FAILED_RUNNING":
            alert("失败:服务器正在运行");
            break;
        default:
            break;
    }
}
async function downloadUserShare(info) {//下载其他用户分享的文件
    window.open(`/?action=downloadShare&account=${info.sharer}&name=${info.name}`);
}

async function removeUserShare(info) {
    if (!confirm("确定移除此分享?")) return
    try {
        await fetch("/", { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: "POST", body: JSON.stringify({ action: "REMOVESHARE", file: info }) })
    } catch (e) {
        alert("发送请求失败");
        return
    }
    alert("已处理");
    initUserShares();
}
function changeLogFrameToDisk() {
    document.getElementById("logFrame").hidden = false;
    document.getElementById("logFrameAdmin").hidden = true;
    document.getElementById("changeLogPage_disk").className = "button_true";
    document.getElementById("changeLogPage_admin").className = "button_false";
    document.getElementById("logFrame").contentWindow.onChanged();

}
function changeLogFrameToAdmin() {
    document.getElementById("logFrame").hidden = true;
    document.getElementById("logFrameAdmin").hidden = false;
    document.getElementById("changeLogPage_disk").className = "button_false";
    document.getElementById("changeLogPage_admin").className = "button_true";
    const adminLog = document.getElementById("logFrameAdmin").contentWindow;
    adminLog.onChanged();
    if (!adminLog.isInit) {
        adminLog.init(`${window.location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:9981`);
    }
}
function setAutoScroll(elem) {
    const adminLogFrame = document.getElementById("logFrameAdmin").contentWindow;
    const diskLogFrame = document.getElementById("logFrame").contentWindow;
    if (elem.className === "button_true") {
        adminLogFrame.autoScroll = false;
        diskLogFrame.autoScroll = false;
        elem.className = "button_false";
    } else {
        adminLogFrame.autoScroll = true;
        diskLogFrame.autoScroll = true;
        elem.className = "button_true";
    }
}
async function openAccountInfoWindow(data) {
    if (accountEditWindow != null) accountEditWindow.close();
    accountEditWindow = window.open("/editTheAccount.editInfoPage", "accountEditWindow", `height=${window.screen.width / 1.5},width=${window.screen.width / 1.5},left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`);
    accountEditWindow.onload = () => {
        accountEditWindow.init(data.userName, location.protocol === "https:" ? configWs : null);
    }
}
function swapHtmlSwitchState(elem) {
    elem.checked = !elem.checked
    elem.src = elem.checked ? htmlButtonTrue : htmlButtonFalse;
}
//子窗口调用
function setMenu(index) {
    for (let menuEle in menuElement) { //文字高亮
        parseInt(menuEle) === index ? menuElement[parseInt(menuEle)].style = "color:blue;" : menuElement[parseInt(
            menuEle)].style = null;
    }
    for (let menuEle in menuDivElement) { //div切换
        parseInt(menuEle) === index ? menuDivElement[parseInt(menuEle)].hidden = false : menuDivElement[parseInt(
            menuEle)].hidden = true;
    }
    if (index === 6 && initedPage[6] === true) {//日志切屏回底部
        document.getElementById("logFrame").contentWindow.scrollToButtom();
        document.getElementById("logFrameAdmin").contentWindow.scrollToButtom();
    }
    if (index !== 0 && initedPage[index] === false) {//按需初始化标签页
        switch (index) {
            case 1://分享
                initUserShares();
                initedPage[index] = true;
                break
            case 2://账户
                initAccountListTable();
                initedPage[index] = true;
                break
            case 3://昵称
                initNicknameExamineTable();
                initedPage[index] = true;
                break
            case 4://管理员共享文件
                initPublicFiles();
                initedPage[index] = true
                break
            case 5:
                initBanip();
                initedPage[index] = true;
                break
            case 6:
                initLogWs();
                initedPage[index] = true;
                break
            default:
                alert("发生异常:无法初始化该标签页");
        }
    }
}