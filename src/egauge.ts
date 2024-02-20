import * as http from 'http';
import {Md5} from 'ts-md5';
import axios, { AxiosResponse, AxiosError } from 'axios';
import {Logger} from 'homebridge';

type UnAuthorizedResponse = {rlm:string; nnc:string; error:string};
type JWTResponse = {jwt:string; rights:string};
type Register = {name:string; type:string; idx:number;did:number;rate:number};
type RegisterResponse = {ts:string; registers:Register[]};
type Hostname = {hostname:string};
type HostnameResponse = {result:Hostname};
type Model = {model:string;sn:string};
type ModelResponse = {result:Model};
function generateRandomHex(size: number): string {
  const randomHex = [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return randomHex;
}

export interface SensorArray {
    [key:string]:number;
}
export class eGaugeAPI {
  public Sensors:SensorArray[] = [];

  private URLbase:string;
  private _jwt='';
  private _hostname = '';
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

  constructor(
        private readonly server: string,
        private readonly username: string,
        private readonly password: string,
        private readonly log:Logger,
  ) {
    this.URLbase = 'http://'+server;
    this.log.debug('Server = '+this.URLbase);
    this.getJWTToken();
  }

  private async getHostname(){
    if(this._jwt === null){
      return;
    }
    const readEndPoint = this.URLbase+'/api/config/net?filter={hostname}';
    const headers = {'Authorization':'Bearer '+this._jwt};
    try{
      const response:AxiosResponse = await axios.get(readEndPoint, {headers});
      const responseData:HostnameResponse = response.data;
      this._hostname = responseData.result.hostname;
      this.log.debug('Connected to host: '+this._hostname);
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        this.log.error(err.message);
      } else {
        this.log.error('Error calling unauthorized API at '+this.URLbase+' '+err);
      }
    }
  }

  private async getDeviceName(){
    if(this._jwt === null){
      return;
    }
    const readEndPoint = this.URLbase+'/api/sys?filter={model,sn}';
    const headers = {'Authorization':'Bearer '+this._jwt};
    try{
      const response:AxiosResponse = await axios.get(readEndPoint, {headers});
      const responseData:ModelResponse = response.data;
      this._deviceName = responseData.result.model;
      this._sn = responseData.result.sn;
      this.log.debug('Model: '+this._deviceName + ', Serial #: '+this._sn);
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        this.log.error(err.message);
      } else {
        this.log.error('Error calling unauthorized API at '+this.URLbase+' '+err);
      }
    }
  }

  public async readRegisters(){
    if(this._jwt === null){
      return;
    }
    const readEndPoint = this.URLbase+'/api/register?reg=1+2+3+4+5+6+7+8&rate';
    const headers = {'Authorization':'Bearer '+this._jwt};

    try{
      const response:AxiosResponse = await axios.get(readEndPoint, {headers});
      const responseData:RegisterResponse = response.data;
      for(const register of responseData.registers){
        this.log.debug('name: '+register.name+ ' rate: '+register.rate);
        this.Sensors[register.name]=register.rate;
      }
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        this.log.error(err.message);
      } else {
        this.log.error('Error calling unauthorized API at '+this.URLbase+' '+err);
      }
    }
  }

  private async getJWTToken(){
    const unAuthEndPoint = this.URLbase+'/api/auth/unauthorized';
    const loginEndPoint = this.URLbase+'/api/auth/login';
    try{
      const response:AxiosResponse = await axios.get(unAuthEndPoint, {
        validateStatus:function(status){
          return status === 401;
        },
      });
      const responseData: UnAuthorizedResponse = response.data;
      const nonce = generateRandomHex(32);
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
      //this.log.debug('JWT: ' + this._jwt);
      this.readRegisters();
      this.getHostname();
      this.getDeviceName();
    } catch (err: unknown){
      if(axios.isAxiosError(err)){
        this.log.error(err.message);
      } else {
        this.log.error('Error calling unauthorized API at '+this.URLbase+' '+err);
      }
    }

  }

}