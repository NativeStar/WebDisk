const exp = require("constants");
const fs = require("fs-extra");
const RT = require("randomthing-js");
class SHARECORE {
    //文件
    /* account:用户名
    shares:[
        {
            id:分享id
            file:文件名
        }
    ] */
    //sharesMap:
    /*
        key:分享id
        value:{
            account:分享者账户
            file:文件名
        } 
     */
    //userShares
    /* 
    key:用户名
    value:{
        [
            id:分享id,
            file:文件
        ]
    } */
    constructor(initObj,path) {
        this._storagePath=path;
        this.sharesMap = new Map();
        this.userShares = new Map();
        //初始化所有分享
        for (let data of initObj) {//所有用户
            //单个用户的分享
            let tempUserSharesArray = [];//暂存当前用户分享的所有文件
            for (let user of data.shares) {
                this.sharesMap.set(user.id, { account: data.account, file: user.file,expire:user.expire});
                tempUserSharesArray.push({ id: user.id, file: user.file ,expire:user.expire});
            }
            this.userShares.set(data.account, tempUserSharesArray);

        }
    }
    clearTimeoutShare(){
        const allShare=this.getAllUserShares();
        const time=new Date().getTime();
        const tempRemoveShares=[];
        for (const iterator of Object.keys(allShare)) {
            if (allShare[iterator].expire===0) continue
            if(allShare[iterator].expire<time){
                tempRemoveShares.push({account:allShare[iterator].account,id:iterator});
            }
        }
        for (const iterator of tempRemoveShares) {
            this.removeShare(iterator.id,iterator.account)
        }
        console.log(`已清理${tempRemoveShares.length}个过期分享`);
    }
    addShare(account, filePath,expire=0) {
        //阻止重复分享
        let tempShareId,shareExpire;
        do {//避免重复id
            tempShareId = RT.number_en(32);
        } while (this.sharesMap.has(tempShareId)) {
            tempShareId = RT.number_en(32);
        }
        switch(expire){
            case "0"://无限
                shareExpire=0;
                break
            case "1":
                shareExpire=new Date().getTime()+86400000;
                break
            case "7":
                shareExpire=new Date().getTime()+604800000;
                break
            case "30":
                shareExpire=new Date().getTime()+2592000000;
                break
            default:
                console.log("无效分享文件有效期");
                return null
        }
        try {
            this.sharesMap.set(tempShareId, { account: account, file: filePath,expire:shareExpire});
            const tempUserShares = this.userShares.get(account) || [];
            tempUserShares.push({ id: tempShareId, file: filePath,expire:shareExpire});
            this.userShares.set(account, tempUserShares);
            return tempShareId
        } catch (error) {
            console.log(error);
            return null
        }
    }
    hasShare(id=""){
        if(!this.sharesMap.has(id)) return false
        const data=this.sharesMap.get(id);
        if(data.expire===0) return true//不限时的分享
        //限时分享 检查时间戳
        return new Date().getTime()<data.expire
    }
    async getShareInfo(id) {
        if (!this.hasShare(id)) {//找不到时返回null
            return null
        }
        const shareFileInfo = this.sharesMap.get(id);
        try {
            return { id: id, file: shareFileInfo.file, size: (await fs.stat(`${this._storagePath}${shareFileInfo.account}/${shareFileInfo.file}`)).size,sharer:shareFileInfo.account}
        } catch (error) {
            console.log(error);
            return null
        }
    }
    getAllUserShares(){
        return Object.fromEntries(this.sharesMap);
    }
    getAllShared(account){
        const userShares=this.userShares.get(account)||[];
        return userShares
    }
    requestDownload(id=""){
        const file=this.sharesMap.get(id);
        if(file==undefined) return null
        return {path:`${this._storagePath}${file?.account}/${file.file}`,name:file.file}
    }
    removeShare(idRemove="",account) {/* 移除分享 */
        //验证是否分享者自身发起删除请求
        for (const fileInfo of this.userShares.keys()) {//遍历所有用户的分享
            for (const oneShare of this.userShares.get(fileInfo)) {//遍历单个用户的分享
                if (oneShare.id === idRemove) {//判断id是否与目标相同
                    const tempUserShares=this.userShares.get(account)||[];
                    //移除用户所有分享列表下的该文件
                    for(let i=0;i<tempUserShares.length;i++){
                        if(tempUserShares[i].id===idRemove){
                            tempUserShares.splice(i,1)
                            break
                        }
                    }
                    return this.sharesMap.delete(idRemove)
                }
            }
        }
        return false//如果找不到要移除的分享id
    }
    
    /**
     * @param {string} [account=""]
     * @memberof SHARECORE
     * @description 清除目标账户的所有分享
     */
    removeAccountAllShare(account=""){
        const rawShares=this.userShares.get(account)||[];
        //浅拷贝会影响forof(只遍历一半)
        const finalShares=JSON.parse(JSON.stringify(rawShares));
        for (const iterator of finalShares) {
            this.removeShare(iterator.id,account);
        }
    }
    async saveSharesMap() {//保存分享索引文件
        const tempSaveMapData = [];
        for (const key of this.userShares.keys()) {
            tempSaveMapData.push({ account: key, shares: this.userShares.get(key) });
        }
        await fs.writeJson("./_server_data/shares.json", tempSaveMapData);
    }
}
module.exports = SHARECORE;