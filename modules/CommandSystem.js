const rl = require("readline");
class CS {
    constructor(commands=[],functionInterface,locked=false) {
        this.locked=locked;
        this.lockPassword=null;
        this.functionInterface=functionInterface;
        this.commands=commands;
        this.rlInterface = rl.createInterface({ input: process.stdin, output: process.stdout});
        this.rlInterface.on("line",value=>this.newLineListener(value));
        this.rlInterface.on("close",()=>{
            if(this.locked){//锁定则重新初始化命令系统防止退出
                this.functionInterface.locked_commandRestart();
                this.logYellow("控制台已锁定");
                return
            }
            this.logYellow("命令输入已关闭\n按下Ctrl+C可关闭服务器");
        })
        this.rlInterface.on("SIGINT",()=>{
            if(this.locked){
                this.logYellow("控制台已锁定");
                return
            }
            process.send({signal:"COMMAND_SHUTDOWN",closeAllConnections:true});
        })
    }
    cutInputString(str=""){
        if(str==="") return
        const cmdArray=[];
        if(str.indexOf(" ",0)===-1){
            cmdArray.push(str.slice(0,str.length).replaceAll(" ",""));
            return cmdArray
        }
        let lastStartPoint=0;
        for (let index = 0; index < 100; index++) {
            let temp=str.slice(lastStartPoint===0?0:lastStartPoint+1,str.indexOf(" ",lastStartPoint+1)===-1?str.length:str.indexOf(" ",lastStartPoint+1)).replaceAll(" ","");
            if(temp.replaceAll(" ","")!==""){
                cmdArray.push(temp);
            }
            lastStartPoint=str.indexOf(" ",lastStartPoint+1);
            if(lastStartPoint===-1) return cmdArray
        }
        return cmdArray
    }
    newLineListener(input){
        const cmdTemp=this.cutInputString(input);
        if(cmdTemp===undefined) return
        if(this.locked&&cmdTemp[0]!=="unlock"){
            this.logYellow("命令已停用");
            return
        }
        switch(cmdTemp[0]){
            case "help":
                this.command_help(cmdTemp);
                break
            case "lock":
                this.command_lock(cmdTemp);
                break
            case "unlock":
                this.command_unlock(cmdTemp);
                break
            case "clear":
                console.clear();
                break
            case "shutdown":
                if(cmdTemp[1]!==undefined&&!this.isBooleanStr(cmdTemp[1])){
                    this.logRed(`语法错误:参数"closeAllConnections"类型必须为Boolean 接收到的数值为"${cmdTemp[1]}"`)
                    return
                }
                process.send({signal:"COMMAND_SHUTDOWN",closeAllConnections:cmdTemp[1]});
                break
            case "account":
                this.command_account(cmdTemp);
                break
            case "config":
                this.command_config(cmdTemp);
                break
            case "getStatistics":
                this.functionInterface.cmd_statistics();
                break
            case "share":
                this.command_share(cmdTemp);
                break
            case "nickname":
                this.command_nickname(cmdTemp);
                break
            case "refreshPublicFile":
                this.functionInterface.rpfl();
                break
            case "banip":
                this.command_banip(cmdTemp);
                break
            case "test":
                this.functionInterface.test(cmdTemp);
                break
            default:
                this.logRed(`未知命令:${cmdTemp[0]}\n请检查该命令是否存在 可输入help查看命令列表`);
        }
    }
    command_help(args){
        if(args.length>2){
            this.logRed(`参数错误 情检查输入\n>>${args[2]}<<`);
            return
        }
        if(args.length===1){
            this.logGreen("命令列表:");
            for (const obj of this.commands) {
                let outputBuffer=`${obj.cmd}--${obj.desc}`;
                console.log(outputBuffer);
            }
            this.logYellow('输入:"help 命令名"查看对应命令用法');
        }else{
            const cmdIndex=(this.commands.find((value)=>{
                return value.cmd===args[1];
            }));
            if(cmdIndex===undefined){
                this.logRed(`找不到命令:${args[1]}\n请检查拼写或命令是否存在`);
                return
            }
            let strBuffer=cmdIndex.desc+(cmdIndex.methods===undefined?"\n":"");
            for (const iterator of cmdIndex.arg) {
                strBuffer=strBuffer.concat("<",iterator.name,":",iterator.type,"> : ",iterator.desc);
            }
            this.logGreen(strBuffer);
            if(cmdIndex.methods!==undefined){
                this.logYellow("用法列表:")
                for (const method of cmdIndex.methods) {
                    let methodsTextBuffer=`${cmdIndex.cmd} `;
                    for (const values of method) {
                        if(values.type==="action"){
                            methodsTextBuffer=methodsTextBuffer.concat(values.arg," ");
                        }else{
                            methodsTextBuffer=methodsTextBuffer.concat("<",values.arg,":",values.type,"> ");
                        }
                    }
                    console.log(methodsTextBuffer);
                }
            }

        }
    };
    command_lock(args){
        if(args.length>2){
            this.logRed(`参数错误 请检查输入\n>>${args[2]}<<`);
            return
        }
        if(args.length===2){
            this.lockPassword=args[1];
            console.clear();
        }
        this.locked=true;
        this.logYellow("命令已停用");
    };
    command_unlock(args){
        if(args.length>2){
            this.logRed(`参数错误 情检查输入\n>>${args[2]}<<`);
            return
        }
        if(!this.locked){
            this.logYellow("当前控制台无需解锁");
            return
        }
        if(this.lockPassword===null){
            this.locked=false;
            this.logYellow("控制台已解锁");
        }else{
            if (args[1]!==this.lockPassword) {
                this.logYellow("密码错误");
                return
            }
            this.locked=false;
            this.lockPassword=null;
            this.logYellow("控制台已解锁");
        }
    };
    command_account(args){
        if(args[1]===undefined){
            this.logYellow("命令:account\nlist:列出所有账户\ncreate:创建一个账户 <用户名:string> <密码:string> <邮箱:string>");
            this.logYellow("remove:移除一个账户 <用户名:string> <移除存储空间(可选 默认false):booleam>");
            this.logYellow("getConfig:查看账户配置信息 <用户名:string>");
            this.logYellow("setConfig:修改账户配置 <用户名:string> <配置:string> <值:any>\nlogout:退出账户登录 <用户名:string>");
            this.logYellow("deleteDisabledAccount:清除所有被停用账户的数据(申请注销及手动设置enabled为false)");
            return
        }
        this.functionInterface.cmdAccount(args);
    }
    command_config(args){
        if(args[1]===undefined){
            this.logYellow("命令:config\nget:查看所有配置\nset:更改一个配置 <配置:string> <值:any>");
            this.logYellow("特例:set mailerConfig <发件邮箱:string> <授权码:string> <域名:string> <端口:number>")
            this.logYellow("大多数配置需完全重启服务器才能生效");
            return
        }
        if(args[1]!=="get"&&args[1]!=="set"){
            this.logYellow('配置操作仅有get和set\n输入"help config"或"config"查看使用方法');
            return
        }
        this.functionInterface.cmdConfig(args)
    }
    command_share(args){
        if (args[1]===undefined) {
            this.logYellow("命令:share\nlist:查看所有分享 <账户?:string>(仅查看单个用户所有分享)\nremoveAccount:移除一个账户的所有分享 <账户:string>");
            this.logYellow("removeId:根据id移除单个分享 <id:string>");
            return
        }
        this.functionInterface.cmd_share(args);
    }
    command_nickname(args){
        if(args[1]===undefined){
            this.logYellow("命令:nickname\nlist:所有待审核昵称列表\nagree:通过更改申请 <账户:string>");
            this.logYellow("reject:拒绝更改申请 <账户:string>");
            return
        }
        this.functionInterface.cmd_nick(args);
    }
    command_banip(args){
        if(args[1]===undefined){
            this.logYellow("命令:banip\nlist:所有封禁IP列表\nadd:添加封禁IP <ip:string>");
            this.logYellow("remove:解封指定IP <IP:string>");
            return
        }
        this.functionInterface.cmd_banip(args);
    }
    /**
     *
     *
     * @param {string} [str="null"]
     * @return {boolean} 
     * @memberof CS
     * @description 判断字符串是否为true或false
     */
    isBooleanStr(str="null"){
        return (str==="true"||str==="false")
    }
    logYellow(...str){
        console.log(`\x1B[33m${str}\x1b[0m`);
    }
    logRed(...str){
        console.log("\x1B[31m" + str + "\x1b[0m");
    }
    logGreen(...str){
        console.log("\x1B[32m" + str + "\x1b[0m");
    }
}
module.exports=CS;