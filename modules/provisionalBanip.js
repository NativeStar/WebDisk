class PBI {
    constructor(time = 300000,enable=true) {
        this.banList = new Map();
        this.trigger = new Map();
        this.banTime = time;
        this.enable=enable;
    }
    isBanned(ip = "") {
        if (!this.banList.has(ip)) return false
        if (new Date().getTime() < this.banList.get(ip)){
            return true
        }
        return false
    }
    addBan(ip){//直接ban
        if(!this.enable) return
        this.banList.set(ip, new Date().getTime() + this.banTime);
        this.trigger.set(ip,0);
        console.log(`IP地址"${ip}"已被临时封禁`);
    }
    addCount(ip = "") {//触发模式 达到3次ban
        if(!this.enable) return
        //正常被ban了就不会触发异常 没必要检测ban是否结束
        const tempIp = this.trigger.get(ip);
        //如果没有触发记录
        if (tempIp === undefined) {
            this.trigger.set(ip, 1);
            return false
        }
        //有记录但不到3次
        this.trigger.set(ip, tempIp + 1);
        //加起来触发达到3次
        //因为tempIp是一开始就获取的 如果获取到2次加上这次调用刚好三次
        if (tempIp >= 2) {
            this.banList.set(ip, new Date().getTime() + this.banTime);
            this.trigger.set(ip,0);
            console.log(`IP地址"${ip}"已被临时封禁`);
            return true
        }
        return false
    }
}
module.exports = PBI;