import { Component, ViewChild } from '@angular/core';
import { Nav } from 'ionic-angular';
import { FriendsPage } from '../pages/friends/friends';

@Component({
  templateUrl: 'app.html'
})
export class MyApp {
  @ViewChild(Nav) nav: Nav;

  rootPage: any = FriendsPage;

  constructor() {
  }

}
