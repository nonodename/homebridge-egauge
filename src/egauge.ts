/**
 * Minimal implementation of the eGuage API described at https://webapi.redoc.ly/v4.5/tag/Introduction
 * Uses JWT based authentication, so will work over HTTP
*/

import {Md5} from 'ts-md5';
import axios, { AxiosResponse } from 'axios';
import {Logger} from 'homebridge';

type UnAuthorizedResponse = {rlm:string; nnc:string; error:string};
type JWTResponse = {jwt:string; rights:string};
export type Register = {name:string; type:string; idx:number;did:number;rate:number};
type RegisterResponse = {ts:string; registers:Register[]};
type Hostname = {hostname:string};
type HostnameResponse = {result:Hostname};
type Model = {model:string;sn:string};
type ModelResponse = {result:Model};

export class eGaugeAPI {
  public Sensors:{[idx:string]:Register} = {};
  private _requiredRegisters:string[]=[];
  private _readParams = '';
  private _registerSum = 0;
  private URLbase:string;
  private _jwt='';
  private _hostname = '';
  public requiredRegister(idx:string):boolean {
    return (this._requiredRegisters.length < 1 || this._requiredRegisters.includes(idx));
  }

  public get RegisterSum():number{
    return this._registerSum;
  }

  public set RequiredRegisters(reg:string[]){
    this._requiredRegisters = reg;

    if(reg.length < 1){
      this._readParams = '1+2+3+4+5+6+7+8&rate';
    } else {
      this._readParams = reg[0];
      for(let i = 1; i< reg.length; i++){
        this._readParams += '+'+reg[i];
      }
      this._readParams += '&rate';
    }
  }

  public get hostname() {
    return this._hostname;
  }

  private _deviceName = '';
  public get deviceName() {
    return this._deviceName;
  }

  private _sn = '';
  public get sn() {
    return this._sn;
  }

  private static generateRandomHex(size: number): string {
    const randomHex = [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    return randomHex;
  }

  constructor(
        private readonly server: string,
        private readonly username: string,
        private readonly password: string,
        private readonly log:Logger,
  ) {
    this.URLbase = 'http://'+server;
    this.log.debug('Server = '+this.URLbase);
  }

  public async discoverDevice(){
    try{
      await this.getJWTToken();
      // temporarily switch out the registers we read to discover all configured
      const tempReadParams = this._readParams;
      this._readParams = '1+2+3+4+5+6+7+8&rate';
      await Promise.all([this.readRegisters(), this.getHostname(), this.getDeviceName()]);
      this._readParams = tempReadParams;
      this.log.debug('Done discovery with nodename :' + this._hostname);
      setInterval(() => {
        this.getJWTToken();
      }, 540000);    // call refresh JWT every 9 minutes per eGauge docs of 10 min timeout
      return true;
    } catch (error){
      return false;
    }
  }

  private async callAPI(endPoint:string, fn: (response:AxiosResponse) => void){
    if(this._jwt === null){
      return;
    }
    const headers = {'Authorization':'Bearer '+this._jwt};
    try{
      const response:AxiosResponse = await axios.get(endPoint, {headers});
      fn(response);
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        if(err.status === 401){ // the JWT token timed out (which shouldn't happen)
          this.getJWTToken();
          this.log.warn('Had to generate JWT token within callAPI');
        } else {
          this.log.error(err.message);
        }
      } else {
        this.log.error('Error calling API at '+endPoint+' '+err);
      }
    }
  }

  private async getHostname(){
    await this.callAPI(this.URLbase+'/api/config/net?filter={hostname}', (response) =>{
      const responseData:HostnameResponse = response.data;
      this._hostname = responseData.result.hostname;
      this.log.debug('Connected to host: '+this._hostname);
    });
  }

  private async getDeviceName(){
    await this.callAPI(this.URLbase+'/api/sys?filter={model,sn}', (response) =>{
      const responseData:ModelResponse = response.data;
      this._deviceName = responseData.result.model;
      this._sn = responseData.result.sn;
      this.log.debug('Model: '+this._deviceName + ', Serial #: '+this._sn);
    });
  }

  public async readRegisters(){
    await this.callAPI(this.URLbase+'/api/register?reg='+this._readParams, (response) =>{
      const responseData:RegisterResponse = response.data;
      let debug = '';
      let registerSum=0;
      for(const register of responseData.registers){
        this.Sensors[register.idx]=register;
        registerSum+=register.rate;
        debug += register.idx+ ': '+register.rate+', ';
      }
      this._registerSum = registerSum;
      this.log.debug(debug);
    });
  }

  public async getJWTToken(){
    const unAuthEndPoint = this.URLbase+'/api/auth/unauthorized';
    const loginEndPoint = this.URLbase+'/api/auth/login';
    try{
      const response:AxiosResponse = await axios.get(unAuthEndPoint, {
        validateStatus:function(status){
          return status === 401;
        },
      });
      const responseData: UnAuthorizedResponse = response.data;
      const nonce = eGaugeAPI.generateRandomHex(32);
      const ha1 = Md5.hashStr(this.username+':'+responseData.rlm+':'+this.password);
      const hash = Md5.hashStr(ha1+':'+responseData.nnc+':'+nonce);
      const tokenResponse = await axios.post(loginEndPoint, {
        'rlm': responseData.rlm,
        'usr': this.username,
        'nnc': responseData.nnc,
        'cnnc': nonce,
        'hash': hash,
      });
      const tokenResponseData: JWTResponse = tokenResponse.data;
      this._jwt = tokenResponseData.jwt;
      this.log.debug('Refreshed JWT token');
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        this.log.error(err.message);
      } else {
        this.log.error('Error calling unauthorized API at '+this.URLbase+' '+err);
      }
    }

  }

}