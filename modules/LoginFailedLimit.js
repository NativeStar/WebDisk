class LFL{
    constructor(limitTime=1800000){
        this.loginFailed=new Map();
        this.limitTime=limitTime;
    }
    addFailedCount(account,ip){
        if (this.loginFailed.has(account)) {//有任一失败记录
            const failedInfo=this.loginFailed.get(account);
            if (failedInfo[ip]===undefined) {//如无该ip记录则创建并返回
                failedInfo[ip]={count:1,time:new Date().getTime()};
                return
            }
            //超过30分钟重新计算当前ip错误次数
            if (new Date().getTime()>(failedInfo[ip].time+this.limitTime)) {
                failedInfo[ip]={count:1,time:new Date().getTime()};
                return
            }
            //一般情况 增加该ip失败次数
            failedInfo[ip].count++;
            this.loginFailed.set(account,failedInfo);
        }else{//完全无记录 创建当前ip记录
            this.loginFailed.set(account,{[ip]:{count:1,time:new Date().getTime()}});
        }
    }
    remove(account,ip){
        const limitInfo=this.loginFailed.get(account);
        if(limitInfo===undefined) return//如果无记录就是undefined
        Reflect.deleteProperty(limitInfo,ip);
    }
    loginable(account,ip){
        if (!this.loginFailed.has(account)||this.loginFailed.get(account)[ip]===undefined) return true//无记录
        const limitInfo=this.loginFailed.get(account);
        //超时重新计算
        if (new Date().getTime()>(limitInfo[ip].time+this.limitTime)) return true
        if(limitInfo[ip].count<5) return true
        return false
    }
}
module.exports=LFL