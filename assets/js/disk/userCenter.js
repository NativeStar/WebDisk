let userInfo;
const accountName = document.cookie.slice(document.cookie.indexOf("account=") + 8, (document.cookie.indexOf(";",
    document.cookie.indexOf("account="))) === -1 ? document.cookie.length : document.cookie.indexOf(";",
        document.cookie.indexOf("account=")));
let htmlButtonFalse = null,htmlButtonTrue = null;
const emailReg = new RegExp("^[a-zA-Z0-9]+([-_.][A-Za-zd]+)*@([a-zA-Z0-9]+[-.])+[A-Za-zd]{2,5}$");
const xssWord = ["<", ">", "=", "/", "\\", '"', "javascript:"];
const menuDivElement = [document.getElementById("mainInfoDiv"), document.getElementById("shareManagerDiv"), document
    .getElementById("accountSafeDiv"), document.getElementById("otherFunctionDiv")];
const menuElement = [document.getElementById("menu_baseInfo"), document.getElementById("menu_shareManager"), document
    .getElementById("menu_accountSafe"), document.getElementById("menu_other")];
//imgSwitch初始化
document.getElementById("uaDetectSwitch").checked = false;
async function initWeb() {
    htmlButtonFalse = window.URL.createObjectURL((await (await fetch("bitmap_html_switch_false.bitmap", {
        responseType: "blob"
    })).blob()));
    htmlButtonTrue = window.URL.createObjectURL((await (await fetch("bitmap_html_switch_true.bitmap", {
        responseType: "blob"
    })).blob()));
    initNetwork();
    document.getElementById("userNameText").innerText = `用户名:${accountName}`
    document.getElementById("navigatorUA").innerText = navigator.userAgent;
    initEnterAction(); //enter响应
}

function initEnterAction() {
    //昵称
    document.getElementById("changeNickNameInput").onkeydown = (key) => {
        if (key.keyCode === 13) { //回车
            changeNickNameClicked();
        }
    }
    //邮箱
    document.getElementById("changeEmailInput").onkeydown = (key) => {
        if (key.keyCode === 13) { //回车
            changeEmailClicked();
        }
    }
    //密码
    document.getElementById("changePasswordInput").onkeydown = (key) => {
        if (key.keyCode === 13) { //回车
            changePasswordClicked();
        }
    }
    //ua
    document.getElementById("uaDetectInput").onkeydown = (key) => {
        if (key.keyCode === 13) { //回车
            setUserAgentConfig(document.getElementById('uaDetectInput').value);
        }
    }
}
async function initNetwork() {
    userInfo = await (await fetch("/?action=getUserInfomation", {
        credentials: "include"
    })).json();
    document.title = `用户中心:${userInfo.nickName}`;
    initButton();
    initSharedList();
    document.getElementById("nickNameText").innerText = `昵称:${userInfo.nickName}`;
    document.getElementById("mailText").innerText = !userInfo.email ? "邮箱:未设置" : `邮箱:${userInfo.email}`;
    document.getElementById("detectUA").innerText = userInfo.ua === "" ? "未设定" : userInfo.ua.toString();
    document.getElementById("onUAdetectFailedAlert").selectedIndex = userInfo.onUaDetectFailed === "password" ?
        1 : 0;
}
async function initSharedList() {
    let list;
    try {
        list = await (await fetch("/?action=getAllSharedFile")).json();
    } catch (e) {
        document.getElementById('sharesLoadingText').innerText = "获取失败";
        return
    }
    document.getElementById('sharesLoadingText').innerText = `已分享${list.length}个文件`;
    const table = document.getElementById("sharedFileListTable");
    table.children[0].innerHTML = ""
    let headerRow = table.insertRow(0);
    headerRow.innerHTML = '文件名<hr/>'
    let headerCellFileSize = table.rows[0].insertCell(0);
    headerCellFileSize.innerHTML = '分享码<hr>';
    headerCellFileSize.style = "width:53%;"
    let headerCell = table.rows[0].insertCell(1);
    headerCell.innerHTML = '操作<hr>';
    headerCell.style = "width:10%;";
    for (let i = 0; i < list.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.innerHTML =
            `${list[i].file}<hr/>`
        newRow.style = "width:53%;"
        let cellSize = table.rows[i + 1].insertCell(0);
        cellSize.innerHTML = `${list[i].id}<hr/>`
        let cellAction = table.rows[i + 1].insertCell(1);
        cellAction.innerHTML =
            '<button class="removeShare" type="button" onClick="removeShareReq(this)">删除</button><hr/>';
        cellAction.style = "width:10%;"
    }
}

function initButton() {
    const buttons = [ /* document.getElementById("shareViewableSwitch"), */ document.getElementById(
        "uaDetectSwitch")]; //阉割完就一个了...
    const buttonState = [userInfo.uaDetectEnabled];
    for (let elem in buttons) {
        buttons[elem].src = /* htmlButtonTrue; */ buttonState[elem] ? htmlButtonTrue : htmlButtonFalse;
        buttons[elem].checked = buttonState[elem];
    }
}

async function onUAdetectFailedFunction(select) {
    try {
        if (await (await fetch(
            `/?action=setConfig&config=onUAdetectFailed&value=${select.options[select.selectedIndex].value}`
        )).text() !== "SUCCESS") {
            alert("修改失败");
            window.location.reload();
        }
    } catch (e) {
        alert("修改失败,可能是网络异常");
        window.location.reload();
    }
}
window.onload = initWeb;
async function changeNickNameClicked() {
    const inputValue = document.getElementById("changeNickNameInput").value.toString()
    let changeNameResult;
    if (inputValue.length < 1 || inputValue.length > 16) {
        alert("字符数不符合要求");
        return
    }
    if (detectXssString(inputValue)) {
        alert("输入含有不合规字符");
        return
    }
    try {
        changeNameResult = await (await fetch(`/?action=changeNickName&newName=${inputValue}`, {
            credentials: "include"
        })).text()
    } catch (e) {
        alert("提交申请失败:可能是网络或服务端异常");
        return
    }
    switch (changeNameResult) {
        case "WAIT":
            alert("提交成功,请等待审核");
            document.getElementById('nickNameDialog').close();
            break
        case "CHANGE":
            alert("已更改");
            window.location.reload();
            break
        case "HAS":
            alert("已有更改请求在审核队列中");
            document.getElementById('nickNameDialog').close();
            break
        case "SW":
            alert("含有敏感词");
            break
        case 'FAILED':
            alert("请求发生异常");
            break
        case "DISABLED":
            alert("管理员已停用昵称修改功能");
            document.getElementById('nickNameDialog').close();
            break
        default:
            alert("错误:未知回调")
            break
    }
}
async function changeEmailClicked() {
    const inputValue = document.getElementById("changeEmailInput").value.toString();
    let changeEmailResult;
    if (inputValue.length >= 48) {
        alert("输入邮箱过长");
        return
    }
    if (!emailReg.test(inputValue)) {
        alert("邮箱格式异常");
        return
    }
    try {
        changeEmailResult = await (await fetch(`/?action=changeEmail&newEmail=${inputValue}`, {
            credentials: "include"
        })).text()
    } catch (err) {
        alert("提交申请失败:可能是网络或服务端异常");
        return
    }
    if (changeEmailResult === "CHANGED") {
        alert("更改完成");
        window.location.reload();
        return
    }
    alert(`提交更改申请时返回值异常:${changeEmailResult}`)
}
async function uaDetectSwitch(elem) {
    if (!elem.checked) {
        if (confirm('确定启用吗?\n更换设备 系统或浏览器都可能导致无法登录')) {
            try {
                if (await (await fetch(`/?action=setConfig&config=uaDetectEnable&value=true`)).text() ===
                    "SUCCESS") {
                    htmlSwitch(elem);
                    return
                }
                alert("开启失败")
            } catch (e) {
                alert("开启失败:请求异常")
            }

        }
    } else {
        try {
            if (await (await fetch(`/?action=setConfig&config=uaDetectEnable&value=false`)).text() ===
                "SUCCESS") {
                htmlSwitch(elem);
                return
            }
            alert("关闭失败")
        } catch (e) {
            alert("关闭失败:请求异常")
        }

    }
}
async function setUserAgentConfig(uaStr) {
    if (uaStr.length <= 0) {
        alert("UserAgent不能为空");
        return
    }
    if (confirm(`确定修改登录UserAgent为${uaStr}?\n这可能会影响使用其他设备登录`)) {
        try {
            if (await (await fetch(`/?action=setConfig&config=uaDetectString&value=${uaStr}`)).text() ===
                "SUCCESS") {
                alert("修改完成");
                window.location.reload();
            } else {
                alert(`修改失败`)
            }
        } catch (e) {
            alert("修改失败:网络异常");
            return
        }

    }
    //console.log(uaStr)
}
async function changePasswordClicked() {
    const changePasswordInput = document.getElementById("changePasswordInput").value.toString()
    let changePasswordResult;
    if (changePasswordInput.length > 64 || changePasswordInput.length < 2) {
        alert("密码长度不符合规范");
        return
    }
    if (!confirm(`请确认新密码为:${changePasswordInput}`)) {
        return
    }
    try {
        changePasswordResult = await (await fetch(`/?action=changePassword&newPassword=${changePasswordInput}`, {
            credentials: "include"
        })).text()
    } catch (err) {
        alert("提交申请失败:可能是网络或服务端异常");
        return
    }
    if (changePasswordResult === "SUCCESS") {
        alert("修改完成");
        logout();
        return
    }
    alert(`修改失败:${changePasswordResult}`);
    return
}
async function dumpLogs_download() {
    const logFileBlob = await (await fetch("/?action=dumpLog_userDownload", { credentials: "include", responseType: "blob" })).blob();
    let objUrl = null;
    try {
        objUrl = window.URL.createObjectURL(logFileBlob);
        const downloadElem = document.createElement("a");
        downloadElem.href = objUrl;
        downloadElem.setAttribute("download", "AccountLog.log");
        downloadElem.click();
        window.URL.revokeObjectURL(objUrl);
    } catch (e) {
        alert("下载日志文件失败");
        window.URL.revokeObjectURL(objUrl);
    }
}
async function removeShareReq(elem) {
    const shareId = elem.parentElement.parentElement.children[1].innerText;
    let respone;
    if (!confirm(`确定删除分享:${elem.parentElement.parentElement.children[0].innerText}?`)) {
        return
    }
    try {
        respone = await (await fetch(`/?action=removeShare&id=${shareId}`, { credentials: "include" })).text();
    } catch (e) {
        alert("删除失败:网络或服务端异常");
        return
    }
    if (respone === "true") {
        initSharedList();
    } else {
        alert('删除失败');
    }
}
function openAbout(){
    window.open("/about.h","about",`height=${window.screen.width / 1.5},width=${window.screen.width / 1.5},left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`)
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
function logout() {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
    document.cookie = "account=; expires=Thu, 01 Jan 1970 00:00:00 GMT;"
    setTimeout(() => {
        window.location.href = "/index.myWeb"
    }, 150)
}
function setMenu(index) {
    for (let menuEle in menuElement) { //文字高亮
        parseInt(menuEle) === index ? menuElement[parseInt(menuEle)].style = "color:blue;" : menuElement[parseInt(
            menuEle)].style = null;
    }
    for (let menuEle in menuDivElement) { //div切换
        parseInt(menuEle) === index ? menuDivElement[parseInt(menuEle)].hidden = false : menuDivElement[parseInt(
            menuEle)].hidden = true;
    }
}

function htmlSwitch(imgButton) { //开关实现
    imgButton.checked = !imgButton.checked
    imgButton.src = imgButton.checked ? htmlButtonTrue : htmlButtonFalse;
}