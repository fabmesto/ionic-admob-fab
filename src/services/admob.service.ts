import { CacheService } from 'ionic-wp';
import { Injectable } from '@angular/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
  AdMobBannerSize,
  AdMobRewardItem,
  InterstitialAdPluginEvents,
  AdLoadInfo,
  RewardAdPluginEvents,
  AdOptions
} from '@capacitor-community/admob';

import { Subject } from 'rxjs';
import { AcquistiValidatorService } from './acquisti-validator.service';
import { admobInterface } from './admobInterface';
import { Device, DeviceInfo } from '@capacitor/device';
import { PluginListenerHandle } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class AdmobService {

  nascondiADV = false;
  defaulCacheTime = (60 * 5);
  optionsBanner: BannerAdOptions;
  optionsInterstitial: AdOptions;
  optionsRewardvideo: AdOptions;

  admob: admobInterface;

  inAppProductId: string = '';

  private appMargin = 0;
  private bannerPosition: 'top' | 'bottom';

  /**
   * for EventListener
   */
  private eventOnAdSize;
  private eventPrepareReward: PluginListenerHandle;
  private eventRewardReceived: AdMobRewardItem;
  private isLoadingInterstitial = false;
  public isPrepareBanner = false;
  public isPrepareReward = false;
  public isPrepareInterstitial = false;
  public premioRicevutoEvent = new Subject();
  public premioAggiornatoEvent = new Subject();
  public premioUsatoEvent = new Subject();
  public infoDevice: DeviceInfo;

  constructor(
    public cache: CacheService,
    public acquistiService: AcquistiValidatorService,
  ) {
    this.nascondiADV = false;
  }

  async init() {
    this.nascondiADV = this.acquistiService.isValidLocalPurchase(this.inAppProductId);
    if (this.nascondiADV == false) {
      this.infoDevice = await Device.getInfo();
      if (this.infoDevice.platform !== 'web') {
        AdMob.initialize({
          requestTrackingAuthorization: true,
          initializeForTesting: false,
        });

        this.bannerRegisterEvents();
        this.rewardRegisterEvents();
        this.interstitialRegisterEvents();

        setTimeout(() => {
          this.acquistiService.validatorLocalPurchase(this.callbackValidator, this.inAppProductId);
        }, 3000);

        setTimeout(() => {
          this.acquistiService.alertInvalidLocalPurchase(this.inAppProductId);
        }, 6000);
      }
    }
  }

  prepareConfigs() {
    if (this.nascondiADV == false) {
      if (this.infoDevice.platform !== 'web') {
        this.prepareConfigBanner();
        this.prepareConfigRewardvideo();
        // this.prepareConfigInterstitial();
      }
    }
  }

  disableADV() {
    this.nascondiADV = true;
    this.removeBanner();
  }

  enableADV() {
    if (this.nascondiADV == true) {
      this.nascondiADV = this.acquistiService.isValidLocalPurchase(this.inAppProductId);
      this.showBanner();
    }
  }

  /**
   * ==================== Banner ====================
   */
  bannerRegisterEvents() {
    this.bannerPosition = 'bottom';
    this.eventOnAdSize = AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      this.appMargin = size.height;
      if (this.appMargin > 0) {
        const app: HTMLElement = document.querySelector('ion-router-outlet');
        // const app: HTMLElement = document.querySelector('ion-app');
        if (this.bannerPosition === 'top') {
          app.style.marginTop = this.appMargin + 'px';
        } else {
          const body = document.querySelector('body');
          const bodyStyles = window.getComputedStyle(body);
          const safeAreaBottom = bodyStyles.getPropertyValue('--ion-safe-area-bottom');

          app.style.marginBottom = `calc(${safeAreaBottom} + ${this.appMargin}px)`;
          // app.style.marginBottom = this.appMargin + safeAreaBottom + 'px';
        }
      }
    });
    // Subscibe Banner Event Listener
    AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
      console.log('Banner Ad Loaded');
    });
  }

  prepareConfigBanner() {
    if (this.infoDevice.platform == 'ios') {
      this.optionsBanner = {
        adId: this.admob.banner.ios,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      };
    }
    if (this.infoDevice.platform == 'android') {
      this.optionsBanner = {
        adId: this.admob.banner.android,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      };
    }
  }

  showBanner() {
    if (this.nascondiADV == false) {
      if (this.infoDevice.platform !== 'web') {
        AdMob.showBanner(this.optionsBanner);
      }
    }
  }

  async removeBanner() {
    if (this.infoDevice.platform !== 'web') {
      const result = await AdMob.removeBanner().catch(e => console.log(e));
      if (result === undefined) {
        return;
      }

      const app: HTMLElement = document.querySelector('ion-router-outlet');
      app.style.marginTop = '0px';
      app.style.marginBottom = '0px';
    }
  }

  async hideBanner() {
    if (this.infoDevice.platform !== 'web') {
      const result = await AdMob.hideBanner()
        .catch(e => console.log(e));
      if (result === undefined) {
        return;
      }

      const app: HTMLElement = document.querySelector('ion-router-outlet');
      app.style.marginTop = '0px';
      app.style.marginBottom = '0px';
    }
  }

  async resumeBanner() {
    if (this.nascondiADV == false && this.infoDevice.platform !== 'web') {
      const result = await AdMob.resumeBanner()
        .catch(e => console.log(e));
      if (result === undefined) {
        return;
      }

      const app: HTMLElement = document.querySelector('ion-router-outlet');
      const body = document.querySelector('body');
      const bodyStyles = window.getComputedStyle(body);
      const safeAreaBottom = bodyStyles.getPropertyValue('--ion-safe-area-bottom');

      if (this.bannerPosition === 'top') {
        app.style.marginTop = this.appMargin + 'px';
      } else {
        app.style.marginBottom = `calc(${safeAreaBottom} + ${this.appMargin}px)`;
      }
    }
  }
  /**
   * ==================== /Banner ====================
   */

  /**
   * ==================== Interstitial ====================
   */
  interstitialRegisterEvents() {
    AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      this.isPrepareInterstitial = true;
    });
  }

  isTimeForInterstitial(): boolean {
    if (this.nascondiADV === false && this.infoDevice.platform !== 'web') {
      const time = this.getTime('lastinterstitial_time');
      if (!this.cache.isValidTime(time)) {
        return true;
      }
    }
    return false;
  }

  async prepareConfigInterstitial() {
    if (this.infoDevice.platform == 'ios') {
      this.optionsInterstitial = {
        adId: this.admob.interstitial.ios,
      }
    }
    if (this.infoDevice.platform == 'android') {
      this.optionsInterstitial = {
        adId: this.admob.interstitial.android,
      }
    }
    if (this.isLoadingInterstitial == false && this.infoDevice.platform !== 'web') {
      this.isLoadingInterstitial = true;
      const result = AdMob.prepareInterstitial(this.optionsInterstitial)
        .catch(e => console.log(e))
        .finally(() => { this.isLoadingInterstitial = false });
      if (result === undefined) {
        return;
      }
    }
  }

  async showInterstitial() {
    if (this.nascondiADV == false) {
      if (this.isPrepareInterstitial) {
        if (this.isTimeForInterstitial()) {
          const result = await AdMob.showInterstitial()
            .catch(e => console.log(e));
          if (result === undefined) {
            return false;
          }
          this.isPrepareInterstitial = false;
          this.saveTime('lastinterstitial_time');
          this.prepareConfigInterstitial();
          return true;
        }
      } else {
        this.prepareConfigInterstitial();
      }
    }
    return false;
  }
  /**
   * ==================== /Interstitial ====================
   */

  /*
   * ==================== REWARD ====================
   */
  rewardRegisterEvents() {
    this.eventPrepareReward = AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      this.isPrepareReward = true;
    });

    AdMob.addListener(RewardAdPluginEvents.Showed, async () => {

    });

    AdMob.addListener(RewardAdPluginEvents.Rewarded, async (info) => {
      this.eventRewardReceived = info;
      if (this.eventRewardReceived) {
        this.aggiungiPremio(this.eventRewardReceived.amount);
        this.prepareConfigRewardvideo();
      }
    });
  }

  async prepareConfigRewardvideo() {
    if (this.infoDevice.platform == 'ios') {
      this.optionsRewardvideo = {
        adId: this.admob.rewardVideo.ios
      };
    }
    if (this.infoDevice.platform == 'android') {
      // storico
      this.optionsRewardvideo = {
        adId: this.admob.rewardVideo.android
      };
    }
    if (this.infoDevice.platform !== 'web') {
      const result = await AdMob.prepareRewardVideoAd(this.optionsRewardvideo)
        .catch(e => console.log(e))
        .finally(() => {
          // pronto
        });
      if (result === undefined) {
        return;
      }
    }
  }


  async showRewardvideo(ignoreTime: boolean = false): Promise<any> {
    if (this.nascondiADV == false) {
      if (this.isPrepareReward) {
        if (this.isTimeForInterstitial() || ignoreTime) {
          this.eventRewardReceived = undefined;
          const result = AdMob.showRewardVideoAd()
            .catch(e => console.log(e));
          if (result === undefined) {
            return false;
          }
          this.isPrepareReward = false;
          this.saveTime('lastinterstitial_time');
          //this.prepareConfigRewardvideo();
          return true;
        }
      } else {
        this.prepareConfigRewardvideo();
      }
    }
    return false;
  }
  /*
  * ==================== /REWARD ====================
  */

  /**
   * ==================== Premio ====================
   */
  saveTime(key = 'lastinterstitial_time') {
    localStorage.setItem(key, this.cache.timestampInSeconds().toString());
  }

  getTime(key = 'lastinterstitial_time') {
    return localStorage.getItem(key);
  }

  ngOnDestroy() {
    if (this.eventOnAdSize) {
      this.eventOnAdSize.remove();
    }

    if (this.eventPrepareReward) {
      this.eventPrepareReward.remove();
    }
  }

  async aggiungiPremio(premio: number) {
    const amount = await this.getLocalPremio();
    this.saveLocalPremio((amount + premio)).finally(
      () => { this.premioRicevutoEvent.next(premio); }
    );
    this.saveRemotePremio((amount + premio));
  }

  saveLocalPremio(totaleCrediti) {
    return this.cache.setLocal('premio', totaleCrediti);
  }

  async getLocalPremio() {
    let amount = 0;
    const stringVal = await this.cache.getLocal('premio');
    if (stringVal) {
      amount = parseInt(stringVal);
      if (isNaN(amount)) {
        amount = 0;
      }
    }
    return amount;
  }

  async usaPremio(valore: number) {
    const amount = await this.getLocalPremio();
    if (amount >= valore) {
      this.saveLocalPremio((amount - valore)).finally(
        () => {
          this.premioAggiornatoEvent.next((amount - valore));
          this.premioUsatoEvent.next(valore);
          this.saveRemotePremio((amount - valore));
        }
      );
    }
    return (amount - valore);
  }

  async sommaLocalAndRemotePremio() {
    let local = await this.getLocalPremio();
    let remote = await this.getRemotePremio();
    this.premioAggiornatoEvent.next((local + remote));
    this.saveLocalPremio((local + remote));
    this.saveRemotePremio((local + remote));
  }

  async resetLocalPremio() {
    this.saveLocalPremio(0);
    this.premioAggiornatoEvent.next(0);
  }

  async getRemotePremio() {
    let totaleCrediti = 0;
    const resp = await this.cache.wordpress.getUserSettings().toPromise();
    if (resp.code == 'ok') {
      totaleCrediti = parseInt(resp.data.crediti);
    }
    return totaleCrediti;
  }

  async saveRemotePremio(totaleCrediti) {
    let data = {
      'crediti': totaleCrediti,
    };
    this.cache.wordpress.saveUserSettings(data).subscribe(
      (resp: any) => {
      }
    );
  }
  /*
  * ==================== /Premio ====================
  */

  /*
  * ==================== VALIDATOR ====================
  */
  callbackValidator(valid, resp) {
    if (valid) {
      this.nascondiADV = true;
    }
  }
  /*
  * ==================== /VALIDATOR ====================
  */

}