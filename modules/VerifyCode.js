class VCS{
    constructor(){
        this.accountList=new Map();
        this.accountRequestCount={};
        this._verifyErrorCount={};
        this.tokenTemp=new Map();
        this.refreshDate=new Date().getDate();
        setInterval(() => {
            if (new Date().getDate()!==this.refreshDate) {
                console.log("验证码发送限制已刷新");
                this.accountRequestCount={};
                this.refreshDate=new Date().getDate();
            }
        }, 59500);
        this.verifyErrorCount=new Proxy(this._verifyErrorCount,{
            defineProperty:(target,property,desc)=>{
                // property===用户名
                // 达到5次错误会删除本次验证码
                if(desc.value===5){
                    this.accountList.delete(property);
                    console.log(`验证码已删除`);
                    return desc.value
                };
                target[property]=desc.value;
                return desc.value
            },
            get:(target,par)=>{
                if(target[par]===undefined){
                    target[par]=0;
                    return 0
                }
                return target[par];
            }
        })
    }
    addAccount(account="",code=""){
        this.accountList.set(account,{timestamp:new Date().getTime(),code:code.toString()});
        if(this.accountRequestCount[account]===undefined){
            this.accountRequestCount[account]=1;
        }else{
            this.accountRequestCount[account]++;
        }
    }
    removeAccount(account){
        if(account!=null){
            this.accountList.delete(account)
        }
    }
    verify(account="",code="0",needDelete=true){
        const verifyObj=this.accountList.get(account)||{code:"",timestamp:0};
        if(verifyObj?.code===code&&verifyObj.timestamp+300000>(new Date().getTime())){
            if(needDelete) this.accountList.delete(account);
            return true
        }
        this.verifyErrorCount[account]+=1;
        return false
    }
    deleteVerify(account){
        return this.accountList.delete(account)
    }
    allowSendMail(account){
        if(!this.accountList.has(account)){//没有该账号的重置请求则直接通过
            this.accountRequestCount[account]=0;
            return "OK"
        }
        if(this.accountRequestCount[account]>=5){
            return "COUNT"
        }
        if(this.accountList.get(account).timestamp+300000>(new Date().getTime())){//获取时间小于五分钟
            return "TIME"
        }
        return "OK"
    }
}
module.exports=VCS;