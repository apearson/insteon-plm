/* Libraries */
import {EventEmitter} from 'events';
import PLM, { ModemRequest } from '../main';

/* Types */
import { Byte } from 'insteon-packet-parser';

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
export default abstract class InsteonDevice extends EventEmitter{
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
	public static calulateChecksum(cmd1: Byte, cmd2: Byte, userData: Byte[]): Byte{
		/* Calulating sum of userData */
		let sum = cmd1 + cmd2 + userData.reduce((acc, v) => acc += v, 0);

		/* Grabbing last byte of sum */
		let lastByte = (sum % 0xFF);

		/* Complimenting last byte */
		let complimentLastByte = ~lastByte;

		/* Compliment checksum, adding one, then taking last two bytes */
		let checksum = ((complimentLastByte + 1) & 0xFF) as Byte;

		/* Returning checksum */
		return checksum;
	}

	public static startLinking(plm: PLM, deviceID: Byte[]){
		// Setting up command
		const cmd1 = 0x09;
		const cmd2 = 0x01;
		const userData: Byte[] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

		// Calulating check sum
		const checksum = InsteonDevice.calulateChecksum(cmd1, cmd2, userData);

		// Starting linking 
		return plm.sendExtendedCommand(deviceID, 0x1F, 0x09, 0x01, [...userData, checksum]);
	}
}