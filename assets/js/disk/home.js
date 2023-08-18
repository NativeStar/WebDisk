let storageGlobalInfo = {
    usage: 0,
    total: 0
};
let mediaWindow = null; //流媒体窗口
let shareInfoWindow = null; //分享文件窗口
const audioExt = ["mp3", "wav", "ogg", "flac", "aac", "m4s"];
const videoExt = ["mp4", "webm", "avi"] //有videoOgg但很少见
const specialExt = ["xm", "spc"];
const wordFilter = new RegExp('[\\\\/:*?\"<>|]');
const xssWord = ["<", ">", "=", "/", "\\", '"', "javascript:"];
let parsedStorageData;
let fileList;
let userInfo;
window.onload = function () {
    initTable(false);
    initNetwork();
    document.getElementById("shareCodeInput").onkeydown = key => {
        if (key.keyCode === 13) {
            reqShareCode();
        }
    }
}
async function initNetwork() {
    userInfo = await (await fetch("/?action=getUserInfomation", {
        credentials: "include"
    })).json();
    document.getElementById("accountText").innerText = `你好:${userInfo.nickName}(用户中心)`;
    document.title = `${userInfo.nickName}的存储盘`
}
async function initTable(clearTable) {
    fileList = await (await fetch("/?action=stroageSpace", {
        credentials: "include"
    })).json();
    initStorage(clearTable);
    const table = document.getElementById("fileTable");
    if (clearTable) {
        table.children[0].innerHTML = ""
    };
    let headerRow = table.insertRow(0);
    headerRow.innerHTML = '文件名<hr/>'
    let headerCellFileSize = table.rows[0].insertCell(0);
    headerCellFileSize.innerHTML = '大小<hr>'
    let headerCell = table.rows[0].insertCell(1);
    headerCell.innerHTML = '操作<hr>'
    for (let i = 0; i < fileList.files.length; i++) {
        let newRow = table.insertRow(i + 1);
        newRow.innerHTML =
            `<a href="javascript:void(0)" onclick="downloadFile(this)">${fileList.files[i].name}</a><hr/>`;
        let cellSize = table.rows[i + 1].insertCell(0);
        cellSize.innerHTML = `${byte2Mb(fileList.files[i].size)}MB<hr/>`;
        let cellAction = table.rows[i + 1].insertCell(1);
        cellAction.innerHTML =
            '<button class="playMedia" type="button" onClick="launchMediaPlayer(this)">播放</button><button class="delete" type="button" onClick="deleteFile(this)">删除</button><button class="renameButton" type="button" onClick="renameFile(this)">重命名</button><button class="shareFileButton" type="button" onclick="shareOptions(this)">分享</button><hr/>'
    }
}
async function initStorage(isFresh) {
    const progress = document.getElementById("storageProgress");
    const text = document.getElementById("storageText");
    const table = document.getElementById("fileTable");
    storageGlobalInfo.usage = fileList.used;
    storageGlobalInfo.total = fileList.total;
    text.innerText = `已使用${byte2Mb(fileList.used)}MB/${byte2Mb(fileList.total)}MB`;
    progressAnimation(fileList.used, fileList.total, progress, text, isFresh);
}
async function progressAnimation(value, max, progressElem, text, isFresh) {
    //刷新或加载初始化动作不同
    if (isFresh) { //刷新时只执行此if
        let mode = progressElem.value < value //false删除文件进度条降低 true反之
        let refreshStep = parseInt((Math.abs(progressElem.value - value)) / 25);
        let isLowSpace = ((value / max) * 100) >= 85;
        for (let frame = 0; frame < 25; frame++) {
            mode ? progressElem.value = progressElem.value + refreshStep : progressElem.value = progressElem
                .value - refreshStep;
            if (isLowSpace && frame >= 18) {
                text.style = "color: #ff007f;"
            } else {
                text.style = "color: #000000;"
            }
            await sleep(20)
        }
        return
    }
    let step = (max - (max - value)) / 25;
    progressElem.max = max;
    let isLowSpace = ((value / max) * 100) >= 85;
    for (let frame = 0; frame < 25; frame++) {
        progressElem.value = step * frame;
        if (isLowSpace && frame >= 18) text.style = "color: #ff007f;"
        await sleep(25)
    }
}

function byte2Mb(bytes) {
    return parseFloat((bytes / 1024 / 1024).toFixed(2));
}
async function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(null)
        }, time)
    })
}
async function uploadFileFunction() {
    const fileInputer = document.getElementById("uploadFrom");
    const progressElem = document.getElementById("fileProgress");
    if (fileInputer.files.length > 1) { //不支持多文件
        alert("文件选择异常");
        return
    }
    let reader = new FileReader();
    if (fileInputer.files[0] == undefined) return //选择后取消会异常
    reader.readAsArrayBuffer(fileInputer.files[0]);
    fileInputer.disabled = true;
    progressElem.style = "display:inline"
    reader.onprogress = progress => { //载入时
        document.getElementById("uploadActionText").innerText = "读取中...";
        document.getElementById("uploadActionText").style = "display:inline;color: #AB5FF1;";
        progressElem.max = progress.total;
        progressElem.value = progress.loaded;
    }
    reader.onload = async (progress) => { //读取完成
        const inputBuffer = reader.result;
        let uploadXhr = new XMLHttpRequest(); //fetch难做进度条
        let streamReq;
        progressElem.value = 0;
        //校验
        //文件名长度
        if ((fileInputer.files[0].name).length > 100) {
            setTimeout(() => {
                document.getElementById("uploadActionText").innerText = "失败";
                document.getElementById("uploadActionText").style =
                    "display:inline;color: #aa0000;";
                fileInputer.disabled = false
            }, 125);
            reader = null;
            alert("上传失败:文件名过长");
            return
        }
        // xss
        if (detectXssString(fileInputer.files[0].name)) {
            document.getElementById("uploadActionText").innerText = "失败";
            document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
            fileInputer.disabled = false;
            alert("文件名含有不合规内容");
            reader = null;
            setTimeout(() => {
                document.getElementById("uploadActionText").style = "opacity:0.5;color: #aa0000;"
                progressElem.style = "opacity:0.5;"
            }, 1500)
            return
        }
        //文件大小
        if (inputBuffer.byteLength > (storageGlobalInfo.total) - (storageGlobalInfo.usage)) {
            document.getElementById("uploadActionText").innerText = "失败";
            document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
            fileInputer.disabled = false;
            alert("剩余存储空间不足\n请释放空间后重试");
            reader = null;
            setTimeout(() => {
                document.getElementById("uploadActionText").style = "opacity:0.5;color: #aa0000;"
                progressElem.style = "opacity:0.5;"
            }, 1500)
            return
        }
        //文件名重复
        for (let filterName of fileList.files) {
            if (filterName.name === fileInputer.files[0].name) {
                document.getElementById("uploadActionText").innerText = "失败";
                document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
                fileInputer.disabled = false;
                alert("文件名重复\n请删除或重命名后重试");
                reader = null;
                setTimeout(() => {
                    document.getElementById("uploadActionText").style =
                        "opacity:0.5;color: #aa0000;"
                    progressElem.style = "opacity:0.5;"
                }, 1500)
                return
            }
        }
        document.getElementById("uploadActionText").style = "display:inline;color: #ff00ff;";
        document.getElementById("uploadActionText").innerText = "请求创建写入流...";
        try {
            streamReq = await fetch("/", {
                method: "post",
                body: JSON.stringify({
                    name: fileInputer.files[0].name,
                    size: inputBuffer.byteLength
                }),
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        } catch (error) {
            document.getElementById("uploadActionText").innerText = "失败";
            document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
            fileInputer.disabled = false;
            alert("请求服务器失败");
            reader = null;
            setTimeout(() => {
                document.getElementById("uploadActionText").style = "opacity:0.5;color: #aa0000;"
                progressElem.style = "opacity:0.5;"
            }, 1500)
            return
        }
        if (streamReq.status === 201) {
            document.getElementById("uploadActionText").innerText = "上传中...";
            uploadXhr.open("POST", "/");
            uploadXhr.setRequestHeader('Content-Type', "application/x-www-form-urlencoded");
            uploadXhr.onreadystatechange = () => {
                if (uploadXhr.readyState === 4 && uploadXhr.status === 200) {
                    progressElem.value = progressElem.max;
                    document.getElementById("uploadActionText").innerText = "完成";
                    fileInputer.disabled = false;
                    setTimeout(() => {
                        initTable(true); //刷新
                        reader = null;
                        //半透明
                        document.getElementById("uploadActionText").style =
                            "opacity:0.5;color: #ff00ff;"
                        progressElem.style = "opacity:0.5;"
                    }, 1500)
                }
            }
            uploadXhr.upload.onprogress = event => {
                progressElem.max = progress.total;
                progressElem.value = progress.loaded;
            }
            uploadXhr.upload.onerror = event => {
                reader = null;
                document.getElementById("uploadActionText").innerText = "失败";
                document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
                fileInputer.disabled = false;
                alert("上传异常:服务器关闭或连接被中断");
                setTimeout(function () {
                    document.getElementById("uploadActionText").style =
                        "opacity:0.5;color: #aa0000;"
                    progressElem.style = "opacity:0.5;"
                }, 500);
            }
            uploadXhr.send(inputBuffer)
        } else {
            alert("开启上传异常");
            setTimeout(() => {
                document.getElementById("uploadActionText").innerText = "失败";
                document.getElementById("uploadActionText").style =
                    "display:inline;color: #aa0000;";
                fileInputer.disabled = false;
                reader = null;
            }, 125)
        }

    }
    reader.onerror = () => {
        document.getElementById("uploadActionText").innerText = "失败";
        document.getElementById("uploadActionText").style = "display:inline;color: #aa0000;";
        fileInputer.disabled = false
        reader = null;
        alert("读取时发生异常");
    }
}
//分享文件
function shareOptions(elem) {
    document.getElementById("shareDialog").__proto__.rawElement = elem;
    document.getElementById("shareDialog").show();
}
async function shareFile(elem) {
    const exp = document.getElementById("shareFileExpireSelect");
    const shareDialog = document.getElementById("shareDialog");
    let respone, responeJson; //返回内容和分享码
    let fileName = elem.parentElement.parentElement.children[0].innerText;
    if (confirm(`确认分享文件:${fileName}`)) {
        try {
            respone = await fetch(`/?action=shareFile&name=${fileName}&expire=${exp.options[exp.selectedIndex].value}`);
            responeJson = await respone.json();
        } catch (e) {
            switch (respone.status) {
                case 500:
                    alert("服务端发生异常");
                    shareDialog.close();
                    break
                case 401:
                    alert("该账户被禁止使用分享功能");
                    shareDialog.close();
                    break
                case 402:
                    alert("分享失败:包含屏蔽词");
                    shareDialog.close();
                    break
                case 403:
                    alert("服务端拒绝请求");
                    shareDialog.close();
                    break
                case 405:
                    alert("管理员已停用分享相关功能");
                    shareDialog.close();
                    break
                default:
                    alert("分享失败,发生异常");
                    shareDialog.close();
                    break
            }
        }
        alert(`分享成功\n文件分享码为:${responeJson.code}`);
        shareDialog.close();
    }
}
//获取分享信息
async function reqShareCode() {
    const codeInputValue = shareCodeInput.value;
    if (codeInputValue.length !== 32) {
        alert("无效分享码");
        return
    }
    let respone = await (await fetch(`/?action=hasShareFile&id=${codeInputValue.toString()}`))
        .text(); //true false
    if (respone === 'true') {
        if (shareInfoWindow != null) { //只能存在一个窗口 不然会出bug
            shareInfoWindow.close()
        }
        shareInfoWindow = window.open("/shareInfo.win", "shareWindow",
            `height=${window.screen.width / 1.5},width=${window.screen.width / 1.5},left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`
        );
        shareInfoWindow.onload = () => {
            shareInfoWindow.init(codeInputValue.toString());
        }
        document.getElementById('shareCodeDialog').close();
        return
    } else if (respone === "Disabled") {
        alert("管理员已停用分享相关功能");
        document.getElementById('shareCodeDialog').close();
        return
    }
    alert("分享无效 已过期或被取消");
    //新开个html页面获取
}
//删除
async function deleteFile(elem) {
    let fileName = elem.parentElement.parentElement.children[0].innerText;
    if (confirm(`确认删除:${fileName}?`)) {
        let deleteFileRequest = await fetch(`/?action=delete&name=${fileName}`);
        switch (deleteFileRequest.status) {
            case 200:
                setTimeout(() => {
                    initTable(true);
                }, 300)
                break
            case 404:
                alert("删除失败:文件不存在");
                break
            case 500:
                alert("删除失败:服务器内部异常");
                break
        }
    }
}
//重命名
async function renameFile(elem) {
    let fileName = elem.parentElement.parentElement.children[0].innerText;
    let inputBox = document.getElementById("inputBoxElem");
    const dialogView = document.getElementById("renameDialog")
    inputBox.value = fileName;
    dialogView.show();
    document.getElementById("renameSubmit").onclick = async () => {
        if (inputBox.value.toString().length <= 0 || inputBox.value.toString().length >= 100) {
            alert("文件名不能为空或多于100个字符");
            return
        }
        if (inputBox.value.toString() === fileName) { //两次名称相同则直接取消弹窗 不发送给服务端
            setTimeout(() => {
                dialogView.close()
            }, 10);
            return
        }
        //重名检测
        for (let filterName of fileList.files) {
            if (filterName.name === inputBox.value.toString()) {
                alert("与现有文件重名");
                return
            }
        }
        if (wordFilter.test(inputBox.value.toString())) {
            alert('文件名不能出现如下字符\n/ \\ : * ? " < > |');
            return
        }
        if (detectXssString(inputBox.value.toString())) {
            alert("不合规的文件名");
            return
        }
        let renameReq = await fetch(
            `/?action=rename&target=${fileName}&newName=${inputBox.value.toString()}`, {
            credentials: 'include'
        });
        if (renameReq.status === 200) {
            dialogView.close();
            setTimeout(function () {
                initTable(true);
            }, 150);
        } else {
            alert("重命名失败")
        }
    }
    inputBox.onkeydown = (key) => {
        if (key.keyCode === 13) { //回车
            document.getElementById("renameSubmit").onclick()
        }
    }
}

function launchMediaPlayer(elem) {
    let fileName = elem.parentElement.parentElement.children[0].innerText;
    let mediaType = getMediaType(fileName);
    if (mediaType === "unknown") {
        alert("无法打开:非媒体格式或格式不支持");
        return
    } else if (mediaType === "xm") { //ft2格式
        if (mediaWindow != null) {
            mediaWindow.close()
        }
        mediaWindow = window.open("/xmPlayer.ft2", "mediaWindow",
            `height=${window.screen.width / 6},width=${window.screen.width / 5},left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`
        );
        mediaWindow.onload = () => {
            mediaWindow.init(false, fileName)
        }
        return
    } else if (mediaType === "spc") {
        if (mediaWindow != null) {
            mediaWindow.close()
        }
        mediaWindow = window.open("/spc700.player", "mediaWindow",
            `height=${window.screen.width / 6},width=${window.screen.width / 5},left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`
        );
        mediaWindow.onload = () => {
            mediaWindow.init(false, fileName)
        }
        return
    }
    if (mediaWindow != null) { //只能存在一个窗口 不然会出bug
        mediaWindow.close()
    }
    mediaWindow = window.open("/mediaPlayer.subWindow", "mediaWindow",
        `height=${mediaType === "audio" ? window.screen.width / 4.2 : window.screen.width / 1.5},width=${mediaType === "audio" ? window.screen.width / 4.6 : window.screen.width / 1.5},location=no,status=no,left=${(window.screen.width - (window.screen.width / 1.5)) / 2},top=0`
    );
    mediaWindow.onload = () => {
        mediaWindow.initMedia(fileName, mediaType.toUpperCase())
    }
}

function getMediaType(name) {
    //提取后缀名
    let slicedName = name.slice(name.toString().lastIndexOf(".") + 1, name.toString().length);
    if (audioExt.indexOf(slicedName) !== -1) return "audio"
    if (videoExt.indexOf(slicedName) !== -1) return "video"
    if (specialExt.includes(slicedName)) return slicedName.toLowerCase();
    //sp
    return "unknown"
}

function showBytesUsage() {
    alert(
        `已使用:${storageGlobalInfo.usage} Bytes\n总容量:${storageGlobalInfo.total} Bytes\n剩余:${(storageGlobalInfo.total) - (storageGlobalInfo.usage)} Bytes\n单位转换存在误差 容量信息以此对话框为准`
    )
}

function downloadFile(elem) {
    window.open(`?action=download&file=${elem.innerText}`)
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
function logout() { //登出
    if (confirm("退出账户?")) {
        //删除登录cookie
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
        document.cookie = "account=; expires=Thu, 01 Jan 1970 00:00:00 GMT;"
        setTimeout(() => {
            window.location.href = "/index.myWeb"
        }, 150)
    }
}