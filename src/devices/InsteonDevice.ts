/* Libraries */
import {EventEmitter} from 'events';
import * as SerialPort from 'serialport';
import {PLM, ModemRequest} from '../main';

/* Types */
import {Byte} from '../typings/typings';

/* Interface */
export interface DeviceRequest{
	resolve: (data?: any)=> void;
	reject: (error?: Error)=> void;
	command: {
		flags: Byte;
		cmd1: Byte;
		cmd2: Byte;
		userData?: Byte[];
	};
}

/* Abstract class for Insteon Devices */
export abstract class InsteonDevice extends EventEmitter{
	/* Class Info */
	protected address: Byte[];
	protected addressString: string;

	/* Inernal Variaables */
	protected requestQueue: DeviceRequest[] = [];
	protected modem: PLM;
	protected busy: boolean = false;

	/* Constucture */
	constructor(deviceID: Byte[], modem: PLM){
		/* Constucting EventEmitter class */
		super();

		/* Saving serialport */
		this.modem = modem;

		/* Setting up info */
		this.address = deviceID;
		this.addressString = deviceID.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');
	}

	public async sendCommand(flags: Byte, cmd1: Byte, cmd2: Byte, userData?: Byte[]){
		return new Promise((resolve, reject)=>{
			/* Creating device request */
			const deviceRequest: DeviceRequest = {
				resolve,
				reject,
				command:{
					flags,
					cmd1,
					cmd2,
					userData,
				}
			};

			/* Executing request */
			this.execute(deviceRequest);
		});
	}

	/* Command Methods */
	protected execute(request: DeviceRequest){
		/* Pushing request onto device queue */
		this.requestQueue.push(request);

		/* Flushing queue */
		this.flush();
	}
	protected async flush(){
		/* Checking if there is a request lined up and a command is not in progress */
		if(this.requestQueue.length > 0 && !this.busy){
			/* Marking command in flight */
			this.busy = true;

			/* Pulling request from requestQueue */
			const request = this.requestQueue[0];

			/* Checking if there is userData and needs an extended Command */
			if(request.command.userData != undefined){
				await this.modem.sendExtendedCommand(this.address, request.command.flags, request.command.cmd1, request.command.cmd2, request.command.userData);


			}
			else{
				await this.modem.sendStandardCommand(this.address, request.command.flags, request.command.cmd1, request.command.cmd2);
			}

			/* Resolving promise */
			request.resolve();
		}
	}

	/* Utility Methods */
	protected areAddressesSame(a: number[], b: number[]): boolean{
		/* Inital Length check and comparing every index together */
		if(a.length === b.length && a.every((v, i)=> v === b[i])){
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