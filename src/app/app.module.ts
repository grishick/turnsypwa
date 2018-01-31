import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, Injectable, Injector, NgModule } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { MyApp } from './app.component';
import { ListPage } from '../pages/list/list';
import { FriendsPage } from '../pages/friends/friends';
import { AddfriendPage } from '../pages/addfriend/addfriend';
import { EthnetworkProvider } from '../providers/ethnetwork/ethnetwork';
import { HttpModule } from '@angular/http';
import { IonicStorageModule } from '@ionic/storage';
import { QRCodeModule } from 'angular2-qrcode';
import { Pro } from '@ionic/pro';

const IonicPro = Pro.init('70677f09', {
  appVersion: "0.1.0"
});

@Injectable()
export class MyErrorHandler implements ErrorHandler {
  ionicErrorHandler: IonicErrorHandler;

  constructor(injector: Injector) {
    try {
      this.ionicErrorHandler = injector.get(IonicErrorHandler);
    } catch(e) {
      // Unable to get the IonicErrorHandler provider, ensure
      // IonicErrorHandler has been added to the providers list below
    }
  }

  handleError(err: any): void {
    IonicPro.monitoring.handleNewError(err);
    // Remove this if you want to disable Ionic's auto exception handling
    // in development mode.
    this.ionicErrorHandler && this.ionicErrorHandler.handleError(err);
  }
}

@NgModule({
  declarations: [
    MyApp,
    FriendsPage,
    AddfriendPage,
    ListPage
  ],
  imports: [
    HttpModule,
    BrowserModule,
    IonicModule.forRoot(MyApp),
    IonicStorageModule.forRoot(),
    QRCodeModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    FriendsPage,
    AddfriendPage,
    ListPage
  ],
  providers: [
    IonicErrorHandler,
    [{provide: ErrorHandler, useClass: MyErrorHandler}],
    EthnetworkProvider
  ]
})
export class AppModule {}
