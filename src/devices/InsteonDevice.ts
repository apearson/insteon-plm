/* Libraries */
import {EventEmitter} from 'events';
import * as SerialPort from 'serialport';
import {PLM, ModemRequest} from '../main';

/* Types */
import {Byte} from '../typings/typings';

/* Abstract class for Insteon Devices */
export abstract class InsteonDevice extends EventEmitter{
	/* Class Info */
	protected _address: Byte[];
	protected _addressString: string;
	protected _modem: PLM;

	/* Constucture */
	constructor(deviceID: Byte[], modem: PLM){
		/* Constucting EventEmitter class */
		super();

		/* Saving serialport */
		this._modem = modem;

		/* Setting up info */
		this._address = deviceID;
		this._addressString = deviceID.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');
	}

	public async sendStandardCommand(flags: Byte, cmd1: Byte, cmd2: Byte){
		/* Sending standard command to modem */
		return await this._modem.sendStandardCommand(this._address, flags, cmd1, cmd2);
	}
	public async sendExtendedCommand(flags: Byte, cmd1: Byte, cmd2: Byte, userData: Byte[]){
		/* Sending standard command to modem */
		return await this._modem.sendExtendedCommand(this._address, flags, cmd1, cmd2, userData);
	}

	/* Utility Methods */
	protected areAddressesSame(a: number[], b: number[]): boolean{
		/* Inital Length check and comparing every index together */
		if(a.length !== b.length && a.every((v, i)=> v === b[i])){
			return true;
		}
		else{
			return false;
		}
	}
	protected calulateChecksum(userData: Byte[]): Byte{
		/* Calulating sum of userData */
		let checksum = userData.reduce((accum, value)=> ((accum += value) % 0xFF as Byte));

		/* Compliment checksum, adding one, then taking last two bytes */
		checksum = (((~checksum) + 1) & 0xFF) as Byte;

		/* Returning checksum */
		return checksum;
	}
}