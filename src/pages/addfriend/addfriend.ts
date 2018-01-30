import { Component, ViewChild } from '@angular/core';
import { NavController, NavParams, Events } from 'ionic-angular';
import { EthnetworkProvider } from '../../providers/ethnetwork/ethnetwork';

@Component({
  selector: 'page-addfriend',
  templateUrl: 'addfriend.html',
})
export class AddfriendPage {
  friendAddress:string;
  friendName:string;
  @ViewChild('addrInput') friendAddressInput;
  constructor(public navCtrl: NavController, public events: Events, public navParams: NavParams, private ethProvider: EthnetworkProvider) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad AddfriendPage');
  }


  addFriendClicked(event) {
    var context = this;
    console.log("Adding a friend with name " + context.friendName + " and address " + context.friendAddress)
    context.ethProvider.addFriend(context.friendAddress, context.friendName).then((result) => {
        console.log("Added a friend.", result, "Closing AddFriendPage");
        context.navCtrl.pop();
      }
    ).catch((error) => {
      console.log("Error adding friend", error);
    });
  }
}
