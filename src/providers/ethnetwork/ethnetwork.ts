import {Injectable} from '@angular/core';
import {Http} from '@angular/http';
import { Storage } from '@ionic/storage';
import { Events } from 'ionic-angular';
import 'rxjs/add/operator/map';
import * as EthContract  from 'ethjs-contract';
import * as Eth from 'ethjs-query';

import * as Web3 from 'web3';

declare var web3:any;

@Injectable()
export class EthnetworkProvider {
  myAddress:string;
  localWeb3:any;
  fullNodeUrl:string;
  ethContract:any;
  ethContractMeta:{abi:any, unlinked_binary:any, address:string, addedFriendEventTopic:string,receivedFavorEventTopic:string,requestedConfirmationEventTopic:string,token_name:string};
  friends:Map<string /* friend address */,{name:string /* friend name */, scores: {}, confirmations: {}}>;
  localEth:any;
  mySeed:string;
  filterPrefix:string;
  accountReady:boolean;
  provider:any;
  favorNames:Array<string>;
  pendingTransactions:any; //Map<string /* txhash */,string /* friend address */>; //hashes of pending transactions
  constructor(public http:Http, public events: Events, private storage: Storage) {
    this.filterPrefix = "0x000000000000000000000000";
    this.accountReady = false;
    if(!this.pendingTransactions) {
      this.pendingTransactions = {};//new Map<string /* txhash */,string /* friend address */>();
    }
    if(!this.fullNodeUrl) {
      this.fullNodeUrl = 'https://ropsten.infura.io/nXazzJtuW6NO7w88e7Ub';
    }
    if(!this.friends) {
      this.friends = new Map();
    }
    var context = this;

    events.subscribe('nodeurl:changed', (newNodeUrl) => {
      console.log('Received nodeurl:changed event', newNodeUrl);
      context.fullNodeUrl = newNodeUrl;
      context.reset();
    });
  }
  initAll(cb) {
    var context = this;
    context.storage.get('fullNodeUrl').then((val) => {
      if(val) {
        context.fullNodeUrl = val;
      } else {
        context.fullNodeUrl = 'https://ropsten.infura.io/nXazzJtuW6NO7w88e7Ub';
        //context.fullNodeUrl = 'http://127.0.0.1:8545';
        //context.fullNodeUrl = 'http://wallet.inzhoop.com:8546';
        context.storage.set('fullNodeUrl', context.fullNodeUrl);
      }

      context.storage.get("pendingTransactions").then((val) => {
        if(val) {
          console.log("found pending transactions object", val)
          context.pendingTransactions = val;
        }
        this.http.get('https://s3-us-west-1.amazonaws.com/turnsy/AppInit.json').map((res)=>res.json()).subscribe(data => {
          if(data) {
            context.ethContractMeta = {
              address:data.address,
              abi:data.abi,
              unlinked_binary:data.unlinked_binary,
              addedFriendEventTopic:data.addedFriendEventTopic,
              receivedFavorEventTopic:data.receivedFavorEventTopic,
              requestedConfirmationEventTopic:data.requestedConfirmationEventTopic,
              token_name:data.token_name
            };
            console.log("Found coin contract at", context.ethContractMeta.address);
            cb();
          } else {
            cb("FILE_NOT_FOUND");
          }
        });
      });
    });
  }
  reset() {
    this.localEth = null;
    this.provider = null;
    this.friends = new Map();
    this.accountReady = false;
    this.ethContract = {abi:null, address:"", unlinked_binary:null};
    if(this.localWeb3) {
      this.localWeb3.reset();
    }
    this.localWeb3 = null;
    this.favorNames = new Array();
  }

  initAccount(cb)  {
    if(this.accountReady) {
      cb(null, this.myAddress);
    } else {
      var context = this;

      try {
        if(typeof web3 === 'undefined') {
          web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
        }
        context.provider = web3.currentProvider;
        context.localEth = new Eth(context.provider);
        context.localWeb3 = new Web3(context.provider);
        context.localWeb3.eth.getAccounts(function(error, accounts) {
          if(error) {
            cb(error);
          } else if(accounts && accounts[0]) {
            context.myAddress = accounts[0];
            var contract = new EthContract(context.localEth);
            context.pendingTransactions = {};

            var FavToken = contract(context.ethContractMeta.abi, context.ethContractMeta.unlinked_binary, {from:context.myAddress, gas:300000});
            context.ethContract = FavToken.at(context.ethContractMeta.address);
            console.log("Instantiated coin contract at ", context.ethContractMeta.address);
            context.accountReady = true;
            console.log("Initialized account ", context.myAddress);
            context.getFriends(function(error, friends) {
              if(error) {
                cb(error, context.myAddress);
              } else {
                context.getFavorNames(true).then((result) => {
                  context._updatePendingTransactions(function(error) {
                    if(error) {
                      cb(error, context.myAddress);
                    } else {
                      var friendList: Array<string> = new Array<string>();
                      if (context.friends) {
                        context.friends.forEach(function (v, k, m) {
                          v.scores = {};
                          v.confirmations = {};
                          context.friends.set(k, v);
                          friendList.push(k);
                        });
                      }
                      context.getScores(0, friendList, function (error, friends) {
                        cb(error, context.myAddress);
                      });
                    }
                  })
                }).catch((error) => {
                  cb(error, context.myAddress);
                });
              }
            })
          } else {
            cb("Could not load accounts asynchronously");
          }
        });
      } catch (err) {
        cb(err);
      }
    }
  }
  getFavorNames(refresh:boolean) : Promise <Array<string>> {
    var context = this;
    if(!this.accountReady) {
      console.log("Acocunt is not initialized");
      return Promise.reject("account is not initialized");
    } else if(!refresh && context.favorNames.length > 0) {
      return Promise.resolve(context.favorNames);
    } else {

      if(context.ethContract) {
        return context.ethContract.getUserFavors().then(result => {
          console.log("Found favor names " + JSON.stringify(result))
          if(result && result["0"] && result["0"] instanceof Array) {
            context.favorNames = new Array<string>();
            for(var i = 0; i < result["0"].length; i++) {
              var favorName = context.localWeb3.toAscii(result["0"][i]).replace(/\0/g, '');
              if(context.favorNames.indexOf(favorName) < 0) {
                context.favorNames.push(favorName);
                console.log("Added favor name ",favorName);
              }
            }
          }
          return Promise.resolve(context.favorNames);
        })
      } else {
        return Promise.reject("contract " + context.ethContractMeta.address + " not found");
      }
    }
  }
  getTokenBalance():Promise <number> {
    var context = this;
    if(!this.accountReady) {
      console.log("Acocunt is not initialized");
      return Promise.reject("account is not initialized");
    } else {
      console.log("Looking for token balance at ", context.ethContractMeta.address);
      if(context.ethContract) {
        return context.ethContract.balanceOf(this.myAddress).then(result => {
          var balance = result.balance.toNumber();
          console.log("Found token balance " + balance);
          balance = balance - context.getNumPendingTransactions();
          return Promise.resolve(result.balance.toNumber());
        })
      } else {
        return Promise.reject("contract " + context.ethContractMeta.address + " not found");
      }
    }
  }
  getEtherBalance():Promise<number> {
    if(!this.accountReady) {
      return Promise.reject("account is not initialized");
    } else {
      var context = this;
      return context.localEth.getBalance(this.myAddress).then(result => {
        var numInEther = context.localWeb3.fromWei(result, 'ether');
        console.log("Found eher balance " + numInEther);
        return Promise.resolve(numInEther);
      })
    }
  }
  addFriend(friendAddress:string, friendName:string) : Promise <any> {
    if(!this.accountReady) {
      return Promise.reject("account is not initialized");
    } else {
      var context = this;
      if(!context.ethContract) {
        return Promise.reject("Contract at " + context.ethContractMeta.address + " not found");
      } else {
        return context.ethContract.addFriend(friendAddress, context.localWeb3.fromAscii(friendName)).then(
          result => {
            console.log("addFriend succeeded. Transaction hash", result);
            if(!context.friends) {
              context.friends = new Map();
            }
            var friendObject = context.friends.get(friendAddress);
            if(!friendObject) {
              friendObject = {name:friendName, scores:{}, confirmations:{}};
              context.friends.set(friendAddress, friendObject);
              context.events.publish('friendlist:updated', friendAddress, friendName);
            } else {
              friendObject.name = friendName;
              context.friends.set(friendAddress, friendObject);
              context.events.publish('friendlist:updated', friendAddress, friendName);
            }

            return Promise.resolve(result);
          }
        ).catch(error => {
          console.log("addFriend failed. Error", error);
          return Promise.reject(error);
        })
      }
    }
  }
  receiveFavor(friend:string, favorName:string) : Promise <any> {
    if(!this.accountReady) {
      return Promise.reject("account is not initialized");
    } else {
      var context = this;
      if(!context.ethContract) {
        return Promise.reject("Contract at " + context.ethContractMeta.address + " not started");
      } else {
        return context.getTokenBalance().then(balanceOfToken => {
          if(balanceOfToken > 0) {
            return context.ethContract.receiveFavor(friend, context.localWeb3.fromAscii(favorName), 1).then(
              (txHash:string) => {
                if(!context.pendingTransactions) {
                  context.pendingTransactions = {}; //;
                }
                context.pendingTransactions[txHash] = friend;
                console.log("Transaction hash",txHash);
                context.storage.set("pendingTransactions", context.pendingTransactions);
                return Promise.resolve(txHash);
              }
            ).catch(error => {
              return Promise.reject(error);
            });
          } else {
            return Promise.reject("NOT_ENOUGH_TOKENS");
          }
        }).catch(error => {
          return Promise.reject(error);
        });
      }
    }
  }

  /**
   * Fetches a list of indexed 'RequestedConfirmation' events from contract
   * @param friend
   * @param cb
     */
  getConfirmationsRequestEvents(friend:string, cb:any) {
    var context = this;
    context.localWeb3.eth.filter({address: context.ethContractMeta.address, fromBlock:0, toBlock:'latest', topics:[context.ethContractMeta.requestedConfirmationEventTopic, context.filterPrefix + context.myAddress.substr(2), null]}).get((error, events) => {
        if(error) {
          console.log("getConfirmationsRequestEvents(). failed", error);
          cb(error);
        } else {
          console.log("getConfirmationsRequestEvents(). Succeeded", error, events)
          var numEvents = events.length;
          console.log("Found " + numEvents + " confirmation request events");
          for(let i=0; i< numEvents; i++) {
            var friendAddress = "0x" + events[i].topics[2].substr(26);
            var favorName = context.localWeb3.toAscii(events[i].topics[3]).replace(/\0/g, '');
            console.log("Friend address: ", friendAddress);
            console.log("Favor name: ", favorName);
            console.log("Count: ", events[i].topics[4]);
            var friendObject = context.friends.get(friendAddress);
            if(!friendObject) {
              friendObject = {name:"", scores:{}, confirmations:{}};
              context.friends.set(friendAddress, friendObject);
              context.getFriendName(friendAddress);
            }
            if(!friendObject.scores[favorName]) {
              friendObject.scores[favorName] = 0;
            }
            if(context.favorNames.indexOf(favorName) < 0) {
              context.favorNames.push(favorName);
            }
          }
          cb(null, context.friends);
        }
      }
    )
  }

  /**
   * fetch number of favors that I need to confirm for this favorName from friendAddress
   * @param friendAddress
   * @param favorName
   * @returns {Promise<never>|Promise<T>}
     */
  getRequestedConfirmations(friendAddress:string, favorName:string, cb:any) {
    if(!this.accountReady) {
      cb("account is not initialized", 0);
    } else {
      if(!this.ethContract) {
        cb("Contract at " + this.ethContractMeta.address + " not started", 0);
      } else {
        this.ethContract.getRequestedConfirmations(friendAddress, this.myAddress, this.localWeb3.fromAscii(favorName)).then((result:number) => {
          var requested:number = result[0].toNumber();
          console.log("Found that I need to confirm",requested,"favors for", favorName);
          cb(null, requested);
        }).catch(error => {
          console.log(error);
          cb(error, 0);
        });
      }
    }
  }
  /**
   * Add confirmaion request to contract
   * @param friend
   * @param favorName
   * @returns {any}
     */
  requestConfirmation(friend:string, favorName:string) : Promise <any> {
    if(!this.accountReady) {
      return Promise.reject("account is not initialized");
    } else {
      var context = this;

      if(!context.ethContract) {
        return Promise.reject("Contract at " + context.ethContractMeta.address + " not started");
      } else {
        return context.getTokenBalance().then(balanceOfToken => {
            return context.ethContract.requestConfirmation(friend, context.localWeb3.fromAscii(favorName), 1).then(
              (txHash:string) => {
                console.log("Requested confirmation. Transaction hash",txHash);
                return Promise.resolve(txHash);
              }
            ).catch(error => {
              return Promise.reject(error);
            });

        }).catch(error => {
          return Promise.reject(error);
        });
      }
    }
  }
  getFriendsInternal(cb)  {
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      if(this.friends && this.friends.size > 0) {
        console.log("Already loaded friends for", this.ethContractMeta.address, "Returning");
        cb(null, this.friends);
      } else {
        if(!this.friends) {
          this.friends = new Map();
        }
        var context = this;
        console.log("getFriendsInternal(). Loading friends for token", context.ethContractMeta.address);
        var filter = context.localWeb3.eth.filter(
          {
            address: context.ethContractMeta.address,
            fromBlock:0,
            toBlock:'latest',
            from:context.myAddress,
            topics:[context.ethContractMeta.addedFriendEventTopic, context.filterPrefix + context.myAddress.substr(2), null]
          });

        var result = filter.get(function(error, events) {
              if(error) {
                console.log("getFriendsInternal(). failed", error);
                cb(error);
              } else {
                console.log("getFriendsInternal(). Succeeded", error, events)
                var numEvents = events.length;
                console.log("Found " + numEvents + " friend events");
                for(let i=0; i< numEvents; i++) {
                  var friendAddress = "0x" + events[i].topics[2].substr(26);
                  console.log("Friend address: ", friendAddress);
                  var friendObject = context.friends.get(friendAddress);
                  if(!friendObject) {
                    friendObject = {name:"", scores:{}, confirmations:{}};
                  }
                  context.friends.set(friendAddress, friendObject);
                  context.getFriendName(friendAddress);
                }
                console.log("done processing friends. Returning");
                cb(null, context.friends);
              }
            }
          );
        console.log("got filter result", result);
      }
    }
  }

  /**
   * Returns cached friend object
   * @param friendAddress
   * @returns {undefined|{name: string, scores: {}}}
     */
  getFriendObject(friendAddress:string) {
    return this.friends.get(friendAddress);
  }

  /**
   * Fetches name of a friend from contract by address
   * @param friendAddress
   * @returns {any}
     */
  getFriendName(friendAddress:string) : Promise <string> {
    if(!this.accountReady) {
      return Promise.reject("account is not initialized");
    } else {
      console.log("Loading friend name for friend with address", friendAddress);

      if(!this.friends) {
        this.friends = new Map();
      }
      var friendObject = this.friends.get(friendAddress);
      if(friendObject && friendObject.name && friendObject.name != "") {
        return Promise.resolve(friendObject.name);
      } else {
        if(!friendObject) {
          friendObject = {name:"", scores:{}, confirmations:{}};
          this.friends.set(friendAddress, friendObject);
        }
        var context = this;
        if(!context.ethContract) {
          return Promise.reject("Contract at " + context.ethContractMeta.address + " not found");
        } else {
          return context.ethContract.getFriend(friendAddress).then(result => {
            console.log("Received friend name in hex", result.friendName);
            var stringName = "Unknown";
            if(result.friendName == "0x0000000000000000000000000000000000000000000000000000000000000000") {
              stringName = friendAddress;
              console.log("Using address for friend " + stringName);
            } else {
              stringName = context.localWeb3.toAscii(result.friendName).replace(/\0/g, '');
              console.log("Found friend name " + stringName);
            }
            friendObject.name = stringName;
            context.friends.set(friendAddress, friendObject);
            return Promise.resolve(stringName);
          })
        }
      }
    }
  }
  getFriends(cb) {
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      var context = this;
      if(this.friends && this.friends.size > 0) {
        console.log("Already loaded friends. Returning");
        cb(null, this.friends);
      } else {
        this.getFriendsInternal((error, friends) => {
          if (error) {
            console.log("getFriendsInternal returned an error", error)
            cb(error);
          } else {
            console.log("Got friends", friends, "will load scores");
            cb(null, context.friends);
          }
        });
      }
    }
  }

  refreshFriends(cb)  {
    var context = this;
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      this.getFriendsInternal((error, friends) => {
          if(error) {
            cb(error);
          } else{
            cb(null, context.friends);
          }
      });
    }
  }
  markTransactionComplete(txHash: string) {
    try {
      if(!this.pendingTransactions) {
        this.pendingTransactions = {}; //new Map<string /* txhash */,string /* friend address */>();
      }
      if(this.pendingTransactions) {
        if(this.pendingTransactions[txHash]) {
          this.pendingTransactions[txHash] = null;
          console.log("Marked pending transaction complete",txHash);
        }
      }
    } catch (error) {
      console.error("failed to mark pending transactions complete");
    }
    this.storage.set("pendingTransactions", this.pendingTransactions);
  }

  /**
   * Count the number of pending transactions
   * @returns {number}
     */
  getNumPendingTransactions() : number {
    var retVal = 0;
    try {
      if(!this.pendingTransactions) {
        this.pendingTransactions = {};//new Map<string /* txhash */,string /* friend address */>();
      }

      for(let k in this.pendingTransactions) {
        retVal++;
      }
    } catch (error) {
      console.error("failed to get pending transactions for coin");
    }
    console.log("returning",retVal, "pending transactions for", this.ethContractMeta.address);
    return retVal;
  }

  getScores(friendIndex:number, friendList:Array<string>, cb:any) {
    var context = this;
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      console.log("getting scores for friend", friendIndex);
      if(friendIndex < friendList.length) {
        context.getConfirmationsRequestEvents(friendList[friendIndex], function() {
          context._getScoresForOneFriendInternal(friendList[friendIndex], context.favorNames, 0, function (err) {
            if (err) {
              console.log(err);
            }
            friendIndex++;
            context.getScores(friendIndex, friendList, cb);
          })
        })
      } else {
        console.log("Done getting scores for friends")
        cb(null);
      }
    }
  }

  getScoresForOneFriend(friendAddress:string, favorList:Array<string>, index:number, cb:any) {
    var context = this;
    context._updatePendingTransactions(function(error) {
      if(error) {
        cb(error, context.myAddress);
      } else {
        context._getScoresForOneFriendInternal(friendAddress, favorList, index, cb);
      }
    });
  }
  /**
   * Computes scores for one friend recursing through the list of favors. To compute the score for a given favor:
   *  1. fetch received favors from contract
   *  2. fetch given favors from contract
   *  3. subtract received favors from given favors
   *  4. subtract pending transactions from given favors
   *  5. add 0 balances for any outstanding confirmation requests
   * @param friendAddress
   * @param favorList
   * @param index
     * @param cb
     */
  _getScoresForOneFriendInternal(friendAddress:string, favorList:Array<string>, index:number, cb:any) {
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      var context = this;
      if (!context.ethContract) {
        cb("Contract at " + context.ethContractMeta.address + " not found");
      } else {
        if(favorList && favorList.length && (index < favorList.length) && favorList[index]) {
          var favorName = favorList[index];
          context.ethContract.getPerformedFavors(context.myAddress, friendAddress, context.localWeb3.fromAscii(favorName)).then(result => {
            console.log("Received", result[0].toNumber(), "favors from ", friendAddress, "for", favorName, "on", context.ethContractMeta.address);
            var receivedFavors = result[0].toNumber();
            context.ethContract.getPerformedFavors(friendAddress, context.myAddress, context.localWeb3.fromAscii(favorName)).then(result => {
              console.log("Given", result[0].toNumber(), "favors to ", friendAddress, "for", favorName, "on", context.ethContractMeta.address);
              var givenFavors = result[0].toNumber();
              context.getRequestedConfirmations(friendAddress, favorName, function(error, requestedConfirmations) {
                if (context.friends) {
                  let fObj = context.friends.get(friendAddress);
                  if (fObj) {
                    if (!fObj.scores) {
                      fObj.scores = {};
                    }
                    fObj.scores[favorName] = givenFavors - receivedFavors;
                    fObj.confirmations[favorName] = requestedConfirmations;
                    console.log("Set friend's score for", favorName, "to", fObj.scores[favorName]);
                    if (context.pendingTransactions) {
                      for(let k in context.pendingTransactions) {
                        let v = context.pendingTransactions[k];
                        if (v == friendAddress) {
                          var score = fObj.scores[favorName] - 1;
                          fObj.scores[favorName] = score;
                          context.friends.set(friendAddress, fObj);
                          console.log("Updated friend's score for", favorName, "to", fObj.scores[favorName]);
                        }
                      }
                    }
                    index++;
                    if(favorList.length > index) {
                      context._getScoresForOneFriendInternal(friendAddress, favorList, index, cb);
                    } else {
                      cb(null);
                    }
                  } else {
                    console.log("Error! Friend object is null")
                    cb(null);
                  }
                } else {
                  console.log("Error! context.friends is null")
                  cb(null);
                }
              })
            })
          })
        } else {
          cb(null);
        }
      }
    }
  }

  _updatePendingTransactions(cb) {
    if(!this.accountReady) {
      cb("account is not initialized");
    } else {
      var context = this;
      console.log("Will load transactions");
      if(context.friends == null) {
        context.friends = new Map();
      } else {
        if(context.friends) {
          context.friends.forEach(function (v, k, m) {
            v.scores = {};
            v.confirmations = {};
            context.friends.set(k, v);
          });
        }
      }
      context.localWeb3.eth.filter({
        address: context.ethContractMeta.address,
        fromBlock: 0,
        toBlock: 'latest',
        topics: [context.ethContractMeta.receivedFavorEventTopic, null, context.filterPrefix + context.myAddress.substr(2)]
      }).get((error, events) => {
        if (error) {
          console.log("Failed to load friend scores", error);
          cb(error);
        } else {
          var numEvents = events.length;
          console.log("Found",numEvents,"given favor transactions")
          var localMap: Map<string, number> = new Map<string,number>();
          for (let i = 0; i < numEvents; i++) {
            var txHash = events[i].transactionHash;
            if(!localMap.get(txHash)) {
              console.log("Hash of given favor TX ", txHash);
              context.markTransactionComplete(txHash);
            }
          }
          context.localWeb3.eth.filter({
            address: context.ethContractMeta.address,
            fromBlock: 0,
            toBlock: 'latest',
            topics: [context.ethContractMeta.receivedFavorEventTopic, context.filterPrefix + context.myAddress.substr(2), null]
          }).get((error, events) => {
            if (error) {
              cb(error);
            } else {
              var numEvents = events.length;
              console.log("Found",numEvents,"received favor transactions");
              for (let i = 0; i < numEvents; i++) {
                var txHash = events[i].transactionHash;
                if(!localMap.get(txHash)) {
                  console.log("Hash of received favor TX ", txHash);
                  context.markTransactionComplete(txHash);
                }
              }
              console.log("Finished loading transactions");
              cb(null);
            }
          });
        }
      });
    }
  }
}
