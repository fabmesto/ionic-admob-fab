import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { acquistoModel } from './acquistoModel';
import { WordpressService } from 'ionic-wp';
import * as moment from 'moment';
import { InAppPurchase2 } from '@ionic-native/in-app-purchase-2/ngx';
import { Dialog } from '@capacitor/dialog';

@Injectable({
  providedIn: 'root'
})
export class AcquistiValidatorService {

  public acquistati: Array<acquistoModel> = [];
  public logs = [];
  public user_key = '';
  public inapp_key = 'ff_inapp';
  protected currentPlatform = 'ios';

  constructor(
    public platform: Platform,
    public store: InAppPurchase2,
    public wordpress: WordpressService,
  ) {
    if (this.platform.is('android')) {
      this.currentPlatform = 'android';
    }
  }

  getLocal() {
    const repString = localStorage.getItem(this.inapp_key);
    if (repString) { return JSON.parse(repString); }
    return [];
  }

  setLocal(data) {
    localStorage.setItem(this.inapp_key, JSON.stringify(data));
  }

  addLog(message) {
    this.logs.push(message);
  }

  receiptValidator(product, callback) {
    if (this.platform.is('ios')) {
      this.receiptValidatorITunes(product, callback);
    } else {
      this.receiptValidatorGoogle(product, callback);
    }
  }

  receiptValidatorITunes(product, callback) {
    if (product.type == this.store.PAID_SUBSCRIPTION && product.transaction && product.transaction.appStoreReceipt) {
      this.wordpress.itunesValidatePurchase(product).subscribe(
        (resp: any) => {
          this.addLog('iTunes validation resp: ' + JSON.stringify(resp));
          try {
            if (resp.code && resp.code !== 'ok') {
              callback(false, {
                code: 6778005,
                error: {
                  message: 'Impossibile procedere con la validazione dell\'acquisto!'
                }
              });
              this.addLog('(0) Validation error: ' + JSON.stringify(resp.message));
            } else {
              // ok
              if (resp.data && resp.data.in_app) {

                this.acquistati = [];

                for (let in_app of resp.data.in_app) {
                  const acquisto: acquistoModel = {
                    product_id: in_app.product_id,
                    date_check: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
                    time_check_ms: new Date().valueOf(),
                    date_start: moment(parseInt(in_app.purchase_date_ms)).format('YYYY-MM-DDTHH:mm:ssZ'),
                    date_end: moment(parseInt(in_app.expires_date_ms)).format('YYYY-MM-DDTHH:mm:ssZ'),
                    time_start_ms: parseInt(in_app.purchase_date_ms),
                    time_end_ms: parseInt(in_app.expires_date_ms),
                    transaction_id: in_app.transaction_id,
                    auto_renewing: false,
                    token: product.transaction.appStoreReceipt,
                  };
                  this.acquistati.push(acquisto);
                }

                this.setLocal(this.acquistati);
                callback(true, resp.data.in_app); // success!
              } else {
                if (resp.data.error) {
                  this.addLog(resp.data.error);
                  callback(false, {
                    code: 6778005,
                    error: {
                      message: 'Impossibile procedere con la validazione dell\'acquisto!'
                    }
                  });
                } else {
                  callback(false, {
                    code: 6778005,
                    error: {
                      message: 'Impossibile procedere con la validazione dell\'acquisto!'
                    }
                  });
                  this.addLog('(1) Validation error: ' + JSON.stringify(resp.data));
                }
              }
            }
          } catch (err) {
            callback(false, {
              code: 6778005,
              error: {
                message: 'Impossibile procedere con la validazione dell\'acquisto!'
              }
            });
            this.addLog('(2) Validation error: ' + JSON.stringify(err));
          }
        },
        (err) => {
          callback(false, {
            code: 6778002,
            error: {
              message: 'Impossibile procedere con la validazione dell\'acquisto!'
            }
          });
          this.addLog('(3) Validation error: ' + JSON.stringify(err));
        }
      );
    } else {
      console.log('receiptValidatorITunes', product)
      callback(true, {});
    }
  }

  receiptValidatorGoogle(product, callback) {
    if (product.type == this.store.PAID_SUBSCRIPTION && product.transaction && product.transaction.purchaseToken) {
      this.wordpress.googleValidatePurchase(product).subscribe(
        (resp: any) => {
          this.addLog('Android validation resp: ' + JSON.stringify(resp));
          try {
            if (resp.code && resp.code === 'ok') {
              if (resp.data.valid) {
                this.acquistati = [];

                const acquisto: acquistoModel = {
                  product_id: product.id,
                  time_check_ms: new Date().valueOf(),
                  date_check: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
                  date_start: moment(parseInt(resp.data.StartTimeMillis)).format('YYYY-MM-DDTHH:mm:ssZ'),
                  date_end: moment(parseInt(resp.data.ExpiryTimeMillis)).format('YYYY-MM-DDTHH:mm:ssZ'),
                  time_start_ms: parseInt(resp.data.StartTimeMillis),
                  time_end_ms: parseInt(resp.data.ExpiryTimeMillis),
                  transaction_id: product.transaction.id,
                  auto_renewing: resp.data.AutoRenewing,
                  token: product.transaction.purchaseToken,
                };
                this.acquistati.push(acquisto);

                this.setLocal(this.acquistati);

                callback(true, product); // success!
              } else {
                callback(false, {
                  code: 6778003, // PURCHASE_EXPIRED
                  error: {
                    message: resp.message
                  }
                }); // scaduto!
                this.addLog(resp.message + ':' + resp.data.Expiry);
              }
            } else {
              callback(false, {
                code: 6778005,
                error: {
                  message: 'Impossibile procedere con la validazione dell\'acquisto!'
                }
              });
              this.addLog('(1) Validation error');
            }
          } catch (err) {
            callback(false, {
              code: 6778005,
              error: {
                message: 'Impossibile procedere con la validazione dell\'acquisto!'
              }
            });
            this.addLog('(2) Validation error: ' + JSON.stringify(err));
          }
        },
        (err) => {
          callback(false, {
            code: 6778002,
            error: {
              message: 'Impossibile procedere con la validazione dell\'acquisto!'
            }
          });
          this.addLog('(3) Validation error: ' + JSON.stringify(err));
        }
      );
    } else {
      callback(true, {});
    }
  }

  validRoles() {
    let comprato = false;

    const repString = localStorage.getItem(this.user_key);
    if (repString) {
      const user = JSON.parse(repString);
      const roles = user.roles;
      if (roles) {
        if (roles.indexOf('noadv') !== -1) {
          comprato = true;
        }
      }
    }
    return comprato;
  }

  purchaseIsValid(acquisto: acquistoModel) {
    const currentTime = new Date().valueOf();

    if (currentTime <= acquisto.time_end_ms) {
      return true;
    }
    return false;
  }

  isValidLocalPurchase(product_id) {
    let comprato = false;
    comprato = this.validRoles();

    const acquistiSalvati = this.getLocal();
    if (acquistiSalvati.length > 0) {
      for (const obj of acquistiSalvati) {
        if (obj.product_id) {
          const acquisto: acquistoModel = obj;
          if (
            acquisto.product_id === product_id
          ) {
            if (this.purchaseIsValid(acquisto)) {
              comprato = true;
            }
          }
        }
      }
    }
    if (comprato) {
      return true;
    }
    return false;
  }

  async alertInvalidLocalPurchase(product_id) {
    let avvisato = false;
    const acquistiSalvati = this.getLocal();
    if (acquistiSalvati.length > 0) {
      for (const obj of acquistiSalvati) {
        if (obj.product_id) {
          const acquisto: acquistoModel = obj;
          if (
            acquisto.product_id === product_id
          ) {
            if (!this.purchaseIsValid(acquisto)) {
              // abbonamento scaduto
              if (avvisato == false) {
                this.setLocal([]);
                await Dialog.alert({
                  title: 'Abbonamento scaduto',
                  message: 'L\'abbonamento "Nessuna pubblicità" è scaduto o non è stato rinnovato automaticamente.\n Vai nella pagina "Acquisti in-app" per ripristinarlo o acquistarlo nuovamente',
                });
              }
              avvisato = true;
            }
          }
        } else {
          // vecchio formato
          if (avvisato == false) {
            this.setLocal([]);
            await Dialog.alert({
              title: 'Abbonamento da ripristinare',
              message: 'L\'abbonamento "Nessuna pubblicità" al quale sei regolarmente iscritto va ripristinato.\n Vai nella pagina "Acquisti in-app" e clicca su RIPRISTINA ACQUISTI',
            });
          }
          avvisato = true;
        }
      }
    }
  }

  validatorLocalPurchase(callbackValidator, product_id) {
    const acquistiSalvati = this.getLocal();
    if (acquistiSalvati.length > 0) {
      for (const obj of acquistiSalvati) {
        if (obj.product_id) {
          const acquisto: acquistoModel = obj;
          if (
            acquisto.product_id === product_id
          ) {
            const product = {
              'id': acquisto.product_id,
              'transaction': {
                'id': acquisto.transaction_id,
                'appStoreReceipt': acquisto.token,
                'purchaseToken': acquisto.token,
              }
            }
            this.receiptValidator(product, callbackValidator);
          }
        }
      }
    }
  }
}
