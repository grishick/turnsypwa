import { Component, ViewChild } from '@angular/core';
import { NavController, NavParams, Events, List, ToastController } from 'ionic-angular';
import { EthnetworkProvider } from '../../providers/ethnetwork/ethnetwork';
import { Storage } from '@ionic/storage';

@Component({
  selector: 'page-list',
  templateUrl: 'list.html'
})
export class ListPage {
  @ViewChild(List) favorList: List;
  icons: string[];
  newFavorName:string;
  friendAddress:string;
  friendName:string;
  items: Array<{score:number, title: string, note: string, plusLabel:string, minusLabel:string}>;
  favorNames:any;
  constructor(public navCtrl: NavController, public toastCtrl: ToastController, public navParams: NavParams, private ethProvider: EthnetworkProvider, public events: Events, private storage: Storage) {
    this.icons = ['flask', 'wifi', 'beer', 'football', 'basketball', 'paper-plane',
    'american-football', 'boat', 'bluetooth', 'build'];
    this.favorNames = [];
    events.subscribe('friendlist:updated', (friendAddress, friendName) => {
      console.log('Received friendlist:updated event for', friendAddress, friendName);
    });
  }
  reloadFavors(cb:any) {
    var context = this;
    context.ethProvider.getScoresForOneFriend(context.friendAddress, context.favorNames, 0, function(err) {
      if(err) {
        cb(err);
      } else {
        context.loadFavors();
        cb(null);
      }
    });
  }
  loadFavors() {
    console.log("loadFavors called");
    var context = this;

    context.items = [];
    if(!context.favorNames) {
      context.favorNames = [];
    }
    var scores = {};

    //initiate empty scores for all saved favors
    for(var k in context.favorNames) {
      scores[context.favorNames[k]] = "0";
    }

    //this gets cached friend object with cached scores
    var frObj = context.ethProvider.getFriendObject(context.friendAddress);
    for(let k in frObj.scores) {
      console.log("loaded score from network for", k, "=", frObj.scores[k]);
      //add a favor from network
      if(context.favorNames && context.favorNames.indexOf && context.favorNames.indexOf(k) < 0) {
        context.favorNames.push(k);
      }
      scores[k] = frObj.scores[k];
    }

    //create list items
    for(let k in scores) {
      var note = "";
      let v = scores[k];
      if(v > 0) {
        note = "Owes me " + Math.abs(v);
      } else if (v < 0) {
        note = "I owe " + Math.abs(v);
      } else {
        note = "We're even";
      }
      var minusLabel = "Friend scored";
      var plusLabel = "I scored";
      if(frObj.confirmations[k] > 0) {
        minusLabel = "Confirm friend's score";
      }
      console.log("note for", k, "is", note);
      context.items.push({score:v, title:k, note:note, plusLabel:plusLabel, minusLabel:minusLabel})
    }
    context.storage.set("favorNames", context.favorNames);
  }
  loadFavorNamesFromStorage(cb) {
    this.storage.get("favorNames").then((val) => {
      cb(val);
    });
  }
  ionViewDidEnter() {
    var context = this;
    this.friendAddress = this.navParams.get("friendAddress");
    this.friendName = this.navParams.get("friendName");
    this.loadFavorNamesFromStorage(function(val) {
      context.favorNames = val;
      context.loadFavors();
    });
  }
  requestConfirmationTapped(event, item) {
    var context = this;
    console.log("Requesting confirmation that I gave " + item.title + " to " + context.navParams.get("friendAddress"));
    context.ethProvider.requestConfirmation(context.navParams.get("friendAddress"), item.title).then((txHash) => {
      console.log("Transaction",txHash);
      var toast = this.toastCtrl.create({
        message: "We have sent a request to " + context.navParams.get("friendName") + " to confirm your favor",
        showCloseButton: true,
        duration: 3000,
        position: 'top'
      });
      toast.present();
      context.favorList.closeSlidingItems();
    }).catch((err) => {
      console.log(err);
      context.favorList.closeSlidingItems();
      var toast = this.toastCtrl.create({
        message: err,
        showCloseButton: true,
        duration: 3000,
        position: 'top'
      });
      toast.present();
    })
  }
  addFavorTapped(event) {
    var context = this;
    if(!context.favorNames) {
      context.favorNames = [];
    }

    if(context.newFavorName && context.favorNames && context.favorNames.indexOf && context.favorNames.indexOf(this.newFavorName) < 0) {
      context.favorNames.push(this.newFavorName);
    }
    this.storage.set("favorNames", context.favorNames).then(() => {
      context.newFavorName = "";
      context.reloadFavors(function() {});
    }).catch((err) => {
      console.log(err);
    });
  }
  refreshFavorsTapped (refresher) {
    this.reloadFavors(function(err) {
      refresher.complete();
      if(err) {
        var toast = this.toastCtrl.create({
          message: err,
          showCloseButton: true,
          duration: 3000,
          position: 'top'
        });
        toast.present();
      }
    });

  }
  sendTapped(event, item) {
    var context = this;
    console.log("receiving " + item.title + " from " + context.navParams.get("friendAddress"));
    context.ethProvider.receiveFavor(context.navParams.get("friendAddress"), item.title).then(() => {
      console.log("all good");
      var toast = this.toastCtrl.create({
        message: "Favor recorded. It may take a few minutes to update your friend's app.",
        showCloseButton: true,
        duration: 3000,
        position: 'top'
      });
      toast.onDidDismiss(function() {
        context.reloadFavors(function() {});
      });
      item.score--;
      if(item.score > 0) {
        item.note = "Owes me " + Math.abs(item.score);
      } else if (item.score < 0) {
        item.note = "I owe " + Math.abs(item.score);
      } else {
        item.note = "We're even";
      }
      toast.present();
      context.favorList.closeSlidingItems();
    }).catch((err) => {
      console.log(err);
      context.favorList.closeSlidingItems();
      if(err == "NOT_ENOUGH_TOKENS") {
        var toast = this.toastCtrl.create({
          message: "You don't have enough favor tokens",
          showCloseButton: true,
          duration: 3000,
          position: 'top'
        });
        toast.present();
      }
    });
  }
}
