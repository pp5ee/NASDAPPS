'use strict';
//POWERED BY BBSee
//FORK ME ON GITHUB

var Contract = function () {
    LocalContractStorage.defineProperty(this, "possibilities", null);//概率数组
    LocalContractStorage.defineProperty(this, "award1", null);//奖励列表
    LocalContractStorage.defineProperty(this, "fee", null);//抽取奖励的最低费用
    LocalContractStorage.defineProperty(this, "creator", null);//合約发起人
    LocalContractStorage.defineProperty(this, "balance", null);//奖池余额
    LocalContractStorage.defineProperty(this, "winners", null);//获奖者,为保证效率仅记录最近的1000条(包括中奖人,中奖时间戳,中奖数量)
    LocalContractStorage.defineProperty(this, "bigwinners", null);//最高奖历史获得者，同上
    LocalContractStorage.defineProperty(this, "interval", null);//奖励在0-10的随机数上的概率区间
    LocalContractStorage.defineProperty(this, "oneNasWei", null);
    LocalContractStorage.defineProperty(this, "endHeight", null);//活动结束时间
    LocalContractStorage.defineProperty(this, "defaultfee", null);//活动结束时间
};

Object.prototype.getKeyByValue = function (value) {
    for (var prop in this) {
        if (this.hasOwnProperty(prop)) {
            if (this[prop] == value)
                return prop;
        }
    } 
}
Contract.prototype = {
    init: function (fee,award,possibilities,endHeight) {
        var awardArr=this._str2arr(award);//奖励列表,单位时NAS，转账时请转换为Wei,
        var possibilitiesArr=this._str2arr(possibilities)//奖励机率
        var end=new BigNumber(endHeight);
        if(end%1 !=0 ||end<=Blockchain.block.height){
            throw new Error("Invalid block height");
        };
        //概率个数和奖励个数不匹配时无法执行
        if(awardArr.length !=possibilitiesArr.length){
            throw new Error("Unmatched awards and possibilities");
        }
        var possAmount= 0;
        var possibility=0;
        for(var i=0;i<possibilitiesArr.length;i++){
            possibility=possibilitiesArr[i];
            //概率为负数时无法执行
            if(possibility<0){throw new Error("possibility could not be negative");};
            possAmount=possAmount+possibility;
        };
        for(var x=0;x<awardArr.length;x++){
            if(awardArr[x]<0){
              throw new Error("Invalid award amount,amout could not be nagative!");
            }
        };
        //概率不足100%时无法执行合约
        if(possAmount !=100){
            throw new Error("Miscalculated percent possibilities,the sum of possibilities does not equal to 100--yours: "+possibilities+"|"+possAmount);
        };
        this.oneNasWei=new BigNumber(Math.pow(10,18));//NAS2Wei
        this.fee=new BigNumber(fee*this.oneNasWei);
        this.defaultfee=new BigNumber(fee*this.oneNasWei);
        this.award1=awardArr;
        this.possibilities=possibilitiesArr;
        this.creator = Blockchain.transaction.from;//合约的创建者
        this.balance=0;//奖池余额
        this.endHeight=endHeight;
        this.winners={};//所有中奖者,仅仅保留1000条
        this.bigwinners={};//最大奖获得者仅保留最近1000条
        this.interval=this._random_interval(possibilitiesArr);//奖励在0-10的随机数上散布的概率区间
        return "Contract has been deployed";
    },
    //向合约充值用于发放奖励
    charge :function(){
        var amount=new BigNumber(Blockchain.transaction.value);
        this.balance=this.balance+amount;
        return true;
    },
    //开一个福袋
    open:function(){
        BigNumber.config({ ERRORS: false });
        var amount = new BigNumber(Blockchain.transaction.value);//开袋转账
        var endTime=new BigNumber(Blockchain.block.height);//活动结束时间
        if(endTime<this.endHeight){
            this.fee=this.defaultfee/2;
        }else{
            this.fee=this.defaultfee;
        };
        var user_=Blockchain.transaction.from;
        //return amount+"/"+this.fee;
        //当费用小于约定费用时无法继续执行合约
        if (amount<this.fee ) {
                throw new Error("Oops,opening bag failed,your applying fee is not enough.");   
        } else {
            //如果余额小于设置的奖项最大值则不能启动合约
            //return this.award+"/"+this.award[0]+"/"+this.balance;
            if(this.balance<this.award1[0]*this.oneNasWei){
                throw new Error("Opps,the balance of pond is not enough,so you cloud not open this bag");
            };
            var rand=Math.random()*10;
            var awardIndex=-1;
            for(var i=0;i<this.interval.length;i++){
                if(rand<=this.interval[i]){
                    awardIndex=i;
                    break;
                };
            };
            var returnment={};
            var award="award";
            var fault="fault";
            var user="user";
            var grade="grade";
            var amount_="amount";
            var rewardAmountNas=this.award1[awardIndex];
            //return "奖励:"+this.award[awardIndex]+"|awardIndex:"+awardIndex+"|"+"随机数："+rand+"区间:"+this.interval;
            var rewardAmountWei=new BigNumber(this.oneNasWei*rewardAmountNas);
            if(rewardAmountNas==0){
                returnment[award]=false;
                returnment[fault]="00N";
                return returnment;
                //return "{\"award\":false,\"fault\":\"00N\"}";//ERR CODE：00N-you got nothing
            }
            var timestamp = Date.parse(new Date());
            this._cleanRecord();
            var record=[rewardAmountNas,timestamp];//中奖记录单位时NAS
            var records=[];
            let winnerMap=this.winners;
            if(!winnerMap[user_]){
                records[0]=record;
                winnerMap[user_]=records;
            }else{
                records=winnerMap[user_];
                records[records.length]=record;
                winnerMap[user_]=records;
            }
            records=[];
            this.winners=winnerMap;
            if(awardIndex==0){
                let bigwinnerMap=this.bigwinners;
                if(!bigwinnerMap[user_]){
                    records[0]=record;
                    bigwinnerMap[user_]=records;
                }else{
                    records=bigwinnerMap[user_];
                    records[records.length]=record;
                    bigwinnerMap[user_]=records;
                }
                this.bigwinners=bigwinnerMap;//
            }
            var result=this._rewards(user_,rewardAmountWei);
            this._cleanRecord;
            
            if(result){
                returnment[award]=true;
                returnment[amount_]=rewardAmountNas;
                returnment[user]=user_;
                returnment[grade]=awardIndex+1;
                return returnment;
                //return "{\"award\":true,\"amount\":"+rewardAmountNas+",\"user\":\""+user+"\",\"grade\":"+(awardIndex+1)+"}";//获得奖励
            }else{
                returnment[award]=false;
                returnment[fault]="00T";
                return returnment;
                //return "{\"award\":false,\"fault\":\"00T\"}";//transfer failed,我们不承担由于网络错误和区块确认失败等原因造成奖金转账失败的损失
            }
        }
    },
   
    //查询所有的获奖者
    queryAllWinnrs: function(limit){
        if(limit !=null&&(limit<0||!this._numCheck(limit))){
            throw new Error("Invalid limit condition,it could not be nagative or bigger than 1000.");
        };
        let records=this.winners;
        var returnment ={};
        if(this.winners==null){return returnment};
        if(limit==null){
            for(var key in records){
                returnment[this._dataDesensitization(key)]=records[key];
                };
            }else{
                var arr=new Array();
                for(var key in records){
                    arr=records[key];
                returnment[this._dataDesensitization(key)]=arr.slice(0,limit);
            };
            }
            return returnment;
    },
    //查询所有大奖的获得者
    queryBigWinners:function(limit){
        if(limit!=null&&(limit<0||!this._numCheck(limit))){
            throw new Error("Invalid limit condition,it could not be nagative or bigger than 1000.");
        };
        let records=this.bigwinners;
        var returnment ={};
        if(this.bigwinners==null){return returnment};
        if(limit==null){
        for(var key in records){
            returnment[this._dataDesensitization(key)]=records[key];
            };
        }else{
            var arr=new Array();
            for(var key in records){
                arr=records[key];
                returnment[this._dataDesensitization(key)]=arr.slice(0,limit);
                arr=[];
                };
        }
        return returnment;
    },
    //查询用户自己的中奖记录,limit限制查询结果数
    queryOwn: function(limit){
        if(limit !=null&&(limit<0||!this._numCheck(limit))){
            throw new Error("Invalid limit condition,it could not be nagative or bigger than 1000.");
        };
        var user=Blockchain.transaction.from;
        let records=this.winners;
        var returnment=[];
        if(this.winners==null||records[user]==null){return returnment};
        returnment=records[user];
        if(limit>returnment.length){
            limit=returnment.length;
        };
        if(limit==null){
           return returnment;
        }else{
            return returnment.slice(0,limit);           
        };
    } ,
    //按事件出现概率顺序的概率数组,和事件数组,返回对应顺序的具体大小值范围
    _random_interval(possibilitiesArr){
        var possivalue=new BigNumber(0);
        var num=new BigNumber(0);
        var rdi=[];
        for(var i=0;i<possibilitiesArr.length;i++){
             possivalue=new BigNumber(possibilitiesArr[i]/100);
             num=10*possivalue;
            if(rdi.length==0){
             rdi[0]=num;
            }else{
             rdi[i]=rdi[i-1]+num;
            }
        }
        return rdi;
    },
    //脱敏用户地址
    _dataDesensitization(address){
        var front=address.substring(0,3);
        var end=address.substring(address.length-3,address.length);

        return front+"******"+end
    }
    ,
    //字符串转换成数组
    _str2arr(str){
        var strArr=str.split(",");
        var dataIntArr=[]; 
        strArr.forEach(function(data,index,arr){  
        dataIntArr.push(+data);  
        });  
        return dataIntArr;
    },
    //发放奖励
    _rewards(to,amount){
        BigNumber.config({ ERRORS: false });
        //var gas=new BigNumber(Blockchain.transaction.gasLimit);
        let r = Blockchain.verifyAddress(to);
        if (r == 0) {
            throw new Error("The address " + to + " is invalid")
        }
        var amountWei=new BigNumber(amount);
        var result=Blockchain.transfer(to,amountWei);
        var contract=Blockchain.transaction.to;
      /*   Event.Trigger("transfer", {
            Transfer: {
                from: contract,
                to: to,
                value: amountWei
            }
        }); */
        if(result){
            this.balance=this.balance-amountWei;
        }
        return result;
    },
    _cleanRecord(){
        var winnersLength=Object.getOwnPropertyNames(this.winners).length-1000;
        var bigwinnersLength=Object.getOwnPropertyNames(this.bigwinners).length-1000;
        var counter=0;
        if(winnersLength>0){
          for(var key in this.winners){
            if(counter==winnersLength){
                break;
            }
            delete this.winners[key];
            counter+=1;
          }
        };
        if(bigwinnersLength>0){
            for(var key in this.bigwinners){
              if(counter==bigwinnersLength){
                  break;
              }
              delete this.bigwinners[key];
              counter+=1;
            }
          }
    },
    //数字验证
    _numCheck(num){
       
        var reg=/^[0-9]{1,4}$/;   
        return reg.test(num);
       
    }
    ,
    takeout: function (amount) {
        var from = Blockchain.transaction.from;
        let value = new BigNumber(amount*Math.pow(10,18));
        if (from == this.creator) {
            var result = Blockchain.transfer(from, value);
            if (!result) {
                throw new Error("transfer failed.");
            }
            return result;
            /*  Event.Trigger("BankVault", {
                Transfer: {
                    from: Blockchain.transaction.to,
                    to: from,
                    value: value.toString()
                }
            } ); */
        }else{
            var returnment="Permission denied";
            return returnment;
        };
    }
};
module.exports = Contract;