class StringFilter{
    constructor(wordArray=[]){//屏蔽词数组
        this.words=wordArray;
    }
    hasSensitiveWords(str=""){
        let newStr=this.removeChar(str);//过滤空格 符号等
        return this.words.some(value=>{
            return newStr.includes(value)
        })
    }
    removeChar(string=""){//移除干扰字符
        return string.replaceAll(" ","").replaceAll("'","").replaceAll("\"","").replaceAll("!","").replaceAll("$","")
        .replaceAll("@","").replaceAll("&","").replaceAll("+","").replaceAll("*","").replaceAll("[","").replaceAll("]","")
        .replaceAll("\\","").replaceAll("(","").replaceAll(")","").replaceAll("#","").replaceAll("^","").replaceAll("/","")
        .replaceAll("-","").replaceAll("%","").replaceAll("~","").replaceAll("<","").replaceAll(">","").replaceAll("?","")
        .replaceAll("_","").replaceAll("=","").replaceAll(":","").replaceAll(";","").replaceAll(".","").replaceAll("|","")
        .replaceAll("{","").replaceAll("}","").replaceAll("¥","").replaceAll("§","").replaceAll("™","").replaceAll("®","")
        .replaceAll("℗","").replaceAll(",","").toLowerCase()
    }
}
module.exports=StringFilter;