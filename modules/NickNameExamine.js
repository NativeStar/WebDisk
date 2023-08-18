const fs=require("fs-extra");
class NICENAMEEXAMINE{
    constructor(initData){
        this.dataMap=new Map(initData||null);
    }
    get nickList(){
        return Object.fromEntries(this.dataMap);
    }
    get nickMap(){
        return this.dataMap
    }
    pushExamine(account="",oldNickName="",newNickName=""){
        this.dataMap.set(account,{oldName:oldNickName,newName:newNickName});
    }
    hasWaitingfExamine(account){
        return this.dataMap.has(account)
    }
    removeExamine(account){
        return this.dataMap.delete(account);
    }
    async saveExamineMap(){
        const tempMapData=[];
        for(let account of this.dataMap.keys()){
            tempMapData.push([account,{oldName:this.dataMap.get(account).oldName,newName:this.dataMap.get(account).newName}])
        }
        await fs.writeJson("./_server_data/nickName_examine.json",tempMapData);
    }
}
module.exports=NICENAMEEXAMINE