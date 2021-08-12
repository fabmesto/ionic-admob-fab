import { Platform } from '@ionic/angular';
import { CacheService } from 'ionic-wp';
import { Injectable, NgZone } from '@angular/core';
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
import { PluginListenerHandle } from '@capacitor/core';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdmobService {

  private readonly listenerHandlers: PluginListenerHandle[] = [];

  nascondiADV = false;
  defaulCacheTime = (60 * 5);
  optionsBanner: BannerAdOptions;
  optionsInterstitial: AdOptions;
  optionsRewardvideo: AdOptions;

  admob: admobInterface;

  inAppProductId: string = '';

  private appMargin = 0;
  protected bannerPosition: 'top' | 'bottom';

  /**
   * for EventListener
   */
  private isLoadingInterstitial = false;
  public isPrepareBanner = false;
  public isPrepareInterstitial = false;
  public premioRicevutoEvent = new Subject();
  public premioAggiornatoEvent = new Subject();
  public premioUsatoEvent = new Subject();
  public isPrepareReward = false;

  constructor(
    public cache: CacheService,
    public acquistiService: AcquistiValidatorService,
    public readonly platform: Platform,
    public readonly ngZone: NgZone
  ) {
    this.nascondiADV = false;
  }

  init() {
    this.nascondiADV = this.acquistiService.isValidLocalPurchase(this.inAppProductId);
    if (this.nascondiADV == false) {
      if (this.platform.is('android') || this.platform.is('ios')) {
        AdMob.initialize({
          requestTrackingAuthorization: true,
          initializeForTesting: false,
        }).then(() => {
          this.registerBannerSizeChanged();
          this.registerRewardListeners();
          this.prepareConfigBanner();
          this.prepareConfigRewardvideo();
        })

        setTimeout(() => {
          this.acquistiService.validatorLocalPurchase(this.callbackValidator, this.inAppProductId);
        }, 3000);

        setTimeout(() => {
          this.acquistiService.alertInvalidLocalPurchase(this.inAppProductId);
        }, 6000);
      }
    }
  }

  private registerRewardListeners(): void {
    const rewardLoadedHandler = AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      // Subscribe prepared rewardVideo
      console.log('rewardLoaded', info);
      this.isPrepareReward = true;
    });

    const rewardedHandler = AdMob.addListener(RewardAdPluginEvents.Rewarded, (rewardItem: AdMobRewardItem) => {
      // Subscribe user rewarded
      this.ngZone.run(() => {
        this.aggiungiPremio(rewardItem.amount);
      });
      this.prepareConfigRewardvideo();
    });

    this.listenerHandlers.push(rewardLoadedHandler);
    this.listenerHandlers.push(rewardedHandler);
  }

  public registerBannerSizeChanged(): void {
    const resizeHandler = AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: AdMobBannerSize) => {
      this.appMargin = info.height;
      const app: HTMLElement = document.querySelector('ion-router-outlet');

      if (this.appMargin === 0) {
        app.style.marginTop = '';
        return;
      }

      if (this.appMargin > 0) {
        const body = document.querySelector('body');
        const bodyStyles = window.getComputedStyle(body);
        const safeAreaBottom = bodyStyles.getPropertyValue("--ion-safe-area-bottom");


        if (this.bannerPosition === 'top') {
          app.style.marginTop = this.appMargin + 'px';
        } else {
          app.style.marginBottom = `calc(${safeAreaBottom} + ${this.appMargin}px)`;
        }
      }
    });

    this.listenerHandlers.push(resizeHandler);
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

  prepareConfigBanner() {
    if (this.platform.is('ios')) {
      this.optionsBanner = {
        adId: this.admob.banner.ios,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      };
    }
    if (this.platform.is('android')) {
      this.optionsBanner = {
        adId: this.admob.banner.android,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      };
    }
    console.log('prepareConfigBanner con queste options', this.optionsBanner);
  }

  async showBanner() {
    if (this.nascondiADV == false) {
      if (this.platform.is('android') || this.platform.is('ios')) {
        console.log('showBanner banner con queste options', this.optionsBanner);

        const result = await AdMob.showBanner(this.optionsBanner).
          catch(e => console.error(e));

        if (result === undefined) {
          return;
        }
        this.isPrepareBanner = true;
      }
    }
  }

  async removeBanner() {
    if (this.platform.is('android') || this.platform.is('ios')) {
      const result = await AdMob.removeBanner()
        .catch(e => console.log(e));
      if (result === undefined) {
        return;
      }

      const app: HTMLElement = document.querySelector('ion-router-outlet');
      app.style.marginBottom = '0px';
      this.appMargin = 0;
      this.isPrepareBanner = false;
    }
  }

  async hideBanner() {
    if (this.platform.is('android') || this.platform.is('ios')) {
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
    if (this.nascondiADV == false && (this.platform.is('android') || this.platform.is('ios'))) {
      const result = await AdMob.resumeBanner()
        .catch(e => console.log(e));
      if (result === undefined) {
        return;
      }

      const app: HTMLElement = document.querySelector('ion-router-outlet');
      app.style.marginBottom = this.appMargin + 'px';
    }
  }
  /**
   * ==================== /Banner ====================
   */

  /**
   * ==================== Interstitial ====================
   */
  interstitialRegisterEvents() {
    const handler = AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      this.isPrepareInterstitial = true;
    });
    this.listenerHandlers.push(handler);
  }

  isTimeForInterstitial(): boolean {
    if (this.nascondiADV === false && (this.platform.is('android') || this.platform.is('ios'))) {
      const time = this.getTime('lastinterstitial_time');
      if (!this.cache.isValidTime(time)) {
        return true;
      }
    }
    return false;
  }

  async prepareConfigInterstitial() {
    if (this.platform.is('ios')) {
      this.optionsInterstitial = {
        adId: this.admob.interstitial.ios,
        isTesting: false,
      }
    }
    if (this.platform.is('android')) {
      this.optionsInterstitial = {
        adId: this.admob.interstitial.android,
        isTesting: false,
      }
    }
    if (this.isLoadingInterstitial == false && (this.platform.is('android') || this.platform.is('ios'))) {
      try {
        const result = await AdMob.prepareInterstitial(this.optionsInterstitial);
        console.log('Interstitial Prepared', result);
        this.isPrepareInterstitial = true;

      } catch (e) {
        console.error('There was a problem preparing the Interstitial', e);
      } finally {
        this.isLoadingInterstitial = false;
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
  async prepareConfigRewardvideo() {
    if (this.platform.is('ios')) {
      this.optionsRewardvideo = {
        adId: this.admob.rewardVideo.ios,
        isTesting: false,
      };
    }
    if (this.platform.is('android')) {
      // storico
      this.optionsRewardvideo = {
        adId: this.admob.rewardVideo.android,
        isTesting: false,
      };
    }

    await AdMob.prepareRewardVideoAd(this.optionsRewardvideo);
    return true;
  }

  async showRewardvideo(ignoreTime: boolean = false): Promise<any> {
    if (this.nascondiADV == false) {
      if (this.isTimeForInterstitial() || ignoreTime) {
        if (!this.isPrepareReward) {
          await this.prepareConfigRewardvideo();
        }
        const rewardItem = await AdMob.showRewardVideoAd();
        this.saveTime('lastinterstitial_time');
        this.isPrepareReward = false;

        return true;
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
    this.listenerHandlers.forEach(event => {
      event.remove();
    })
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