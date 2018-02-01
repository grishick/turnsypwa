import { Component, ViewChild } from '@angular/core';
import { NavController, NavParams, List, ToastController } from 'ionic-angular';
import { EthnetworkProvider } from '../../providers/ethnetwork/ethnetwork';
import { AddfriendPage } from '../addfriend/addfriend';
import { ListPage } from '../list/list';
/**
 * Generated class for the FriendsPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@Component({
  selector: 'page-friends',
  templateUrl: 'friends.html',
})
export class FriendsPage {
  @ViewChild(List) list: List;
  coinName:string;
  coinBalance:number;
  items: Array<{title: string, address: string}>;
  constructor(public navCtrl: NavController, public toastCtrl: ToastController, public navParams: NavParams, private ethProvider: EthnetworkProvider) {

  }

  processFriends(friends) {
    var context = this;
    this.items = [];
    friends.forEach(function (v, k, m) {
      if(k != "0x0000000000000000000000000000000000000000") {
        var friendName = v.name;
        if (!friendName) {
          console.log("Missing a friends name for address", k);
          context.ethProvider.getFriendName(k).then((name) => {
            friendName = name;
            context.items.push({
              address: k,
              title: friendName
            });
          })
        } else {
          context.items.push({
            address: k,
            title: friendName
          });
        }
      }
    })
  }

  showToast(msg:string, duration:number) {
    var toast = this.toastCtrl.create({
      message: msg,
      showCloseButton: true,
      duration: duration,
      position: 'top'
    });
    toast.present();
  }
  loadFriendList() {
    var context = this;
    context.ethProvider.initAll(function(error) {
      if (error) {
        console.log("Failed to initialize");
        context.showToast("Failed to initialize: " + error, 3000);
      } else {
        context.showToast("Please wait", 2000);
        context.ethProvider.initAccount(function (error) {
          if (error) {
            console.log("Need to login");
            context.showToast("Failed to login: " + error, 3000);
          } else {
            context.ethProvider.getFriends((error, friends) => {
              if(error) {
                context.showToast("Failed to load friends: " + error, 3000);
              } else {
                context.processFriends(friends);
                context.coinName = context.ethProvider.ethContractMeta.token_name;
                context.ethProvider.getTokenBalance().then(balanceOfToken => {
                  console.log("balance of", context.coinName, balanceOfToken);
                  context.coinBalance = balanceOfToken;
                  context.showToast("All done", 1000);
                })
              }
            })
          }
        });
      }
    });
  }
  ionViewWillEnter() {
    console.log("ionViewWillEnter")
    this.loadFriendList();
  }

  itemTapped(event, item) {
    this.navCtrl.push(ListPage, {friendAddress:item.address, friendName:item.title})
  }
  addFriendTapped(event) {
    this.navCtrl.push(AddfriendPage);
  }
  refreshFriendsTapped(refresher) {
    this.loadFriendList();
    setTimeout(() => {
      refresher.complete();
    }, 2000);
  }
}
