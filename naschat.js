'use strict';

var Contract = function () {
    LocalContractStorage.defineProperty(this, "passwords", null);
    LocalContractStorage.defineProperty(this, "blacklist", null);//聊天室黑名单
    LocalContractStorage.defineProperty(this, "creator", null);
    LocalContractStorage.defineProperty(this, "trans", null);//转账记录
};

Contract.prototype = {
    init: function () {
        this.passwords = {};//用于存放加密后的密码
        this.creator = Blockchain.transaction.from;
        this.blacklist = {};//黑名单
        this.trans = {};
        return this.creator;
    },
    //用户设置和修改昵称
    modifyNick: function (nick) {
        if (!this._nickNameCheck(nick)) {
            throw new Error("Illegal nick name!");
        };
        var user = Blockchain.transaction.from;
        var nicknames_1 = this.nicknames;
        if (!nicknames_1.hasOwnProperty(user)) {
            nicknames_1[user] = nick;
        } else {
            var oldnick = nicknames_1[user];
            if (oldnick == nick) {
                throw new Error("Commit a different nick name plz");
            } else {
                nicknames_1[user] = nick;
            }
        }
        this.nicknames = nicknames_1;
    },
    //昵称检验,不含特殊字符的数字、字母、汉字 2-8位
    _passCheck(name) {
        var regex = /^[A-Za-z0-9=/]{1,10240}$/
        return regex.test(name);
    },
    //钱包地址校验
    _addressCheck(address) {
        var regex = /^[A-Za-z0-9]{35}$/
        return regex.test(regex);
    },
    //用户登录时调用,存放用户加密后的授权登录信息
    login: function (pass) {
        var from = Blockchain.transaction.from;
        var black = this.blacklist;
        if (black.hasOwnProperty(from)) {
            throw new Error("Blacklist user,contact administrator please");
        }
        if (from != null) {
            var tokens = this.passwords;
            tokens[from] = pass;
            this.passwords = tokens;
            return true;
        } else {
            return false;
        }
    },
    //查询获取用户注册的RSA加密H后的登录密钥用于服务端登录
    getPass: function (address) {
        var passlist = this.passwords;
        return passlist[address];
    },
    //聊天室内的用户之间转账时调用
    userTrans: function (to, amount) {
        var from = Blockchain.transaction.from;
        BigNumber.config({ ERRORS: false });
        //var gas=new BigNumber(Blockchain.transaction.gasLimit);
        let r = Blockchain.verifyAddress(to);
        if (r == 0) {
            throw new Error("The address " + to + " is invalid")
        }
        var amountWei = new BigNumber(amount);
        var result = Blockchain.transfer(to, amountWei);
        var contract = Blockchain.transaction.to;
        var book = this.trans;
        //按区块高度记账
        if (!book.hasOwnProperty(from)) {
            var arr = new Array();
            var record = {};
            record[to] = amount + "/" + Blockchain.block.height;
            book[from] = arr.push(record);
            this.trans = book;
        } else {
            var arr = new Array();
            var userRecord = book;
            arr = book[from];
            var record = {};
            record[to] = amount + "/" + Blockchain.block.height;
            arr.push(record);

        }
        /*   Event.Trigger("transfer", {
              Transfer: {
                  from: contract,
                  to: to,
                  value: amountWei
              }
          }); */

        return true;
    },
    //用户仅能查询自己的转账记录
    queryTrasn: function () {
        var from = Blockchain.transaction.from();
        var book = this.trans;
        return book[from];
    },
    //管理员添加黑名单,入黑名单的用户不能登录
    addBlackList: function (address, reason) {
        var from = Blockchain.transaction.from;
        if (from == this.creator) {
            var list = this.blacklist;
            list[address] = reason;
            this.blacklist = list;
            return true
        } else {
            return false;
        }
    },
    //管理员移除黑名单的某个用户
    removeFromBlack: function (address) {
        var from = Blockchain.transaction.from;
        if (from == this.creator) {
            var black = this.blacklist;
            if (black.hasOwnProperty(address)) {
                delete black.address
            }
            this.blacklist = black;
            return true;
        }
    },
    //查询黑名单
    queryBlack: function () {
        var black = this.blacklist;
        return black;
    }

}
module.exports = Contract;