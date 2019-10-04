/* Libraries */
import { EventEmitter2 } from 'eventemitter2';
import { AsyncQueue, queue, AsyncResultCallback, retryable } from 'async';
import PLM, { QueueTaskData } from '../main';

/* Types */
import { Byte, PacketID, Packets, MessageSubtype } from 'insteon-packet-parser';

/* Interface */
interface DeviceCommandTask {
	cmd1: Byte;
	cmd2: Byte;
	flags?: Byte;
	userData?: Byte[];
	responsePacketType?: Byte;
}

export interface DeviceInfo {
	cat: Byte;
	subcat: Byte;
	firmware: Byte;
	hardward: Byte;
}

/* Abstract class for Insteon Devices */
export default class InsteonDevice extends EventEmitter2 {

	//#region Private Variables

	/* Class Info */
	protected address: Byte[];
	protected addressString: string;

	/* Inernal Variaables */
	protected modem: PLM;
	private requestQueue: AsyncQueue<DeviceCommandTask>;
	protected busy: boolean = false;

	//#endregion

	//#region Constuctor

	constructor(deviceID: Byte[], modem: PLM){
		super({ wildcard: true, delimiter: '::' });

		/* Saving serialport */
		this.modem = modem;

		/* Setting up info */
		this.address = deviceID;
		this.addressString = deviceID.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');

		/* Setting up request queue */
		this.requestQueue = queue(this.processQueue, 1);

		/* Setting up packet rebroadcasting */
		this.setupRebroadcast();
	}

	//#endregion

	//#region Utility Method

	/* Inital Length check and comparing every index together */
	protected areAddressesSame = (a: number[], b: number[]) => 
		(a.length === b.length && a.every((v, i)=> v === b[i]));

	public static calulateChecksum(cmd1: Byte, cmd2: Byte, userData: Byte[]){
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

	//#endregion

	//#region Insteon Send Methods

	public sendInsteonCommand = (cmd1: Byte, cmd2: Byte, userData?: Byte[], flags?: Byte) => new Promise<Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved>((resolve, reject) => {

		/* Sending command */
		this.requestQueue.push({cmd1, cmd2, userData, flags }, (err: Error, data: Packets.StandardMessageRecieved) => {
			if(err) reject(err)
			else resolve(data);
		});	

	});

	//#region Insteon Methods

	public getEngineVersion(): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x0D;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public ping(): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x0F;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public getDeviceInfo = () => new Promise<DeviceInfo>((resolve, reject) => {
		
		// Setting up command
		const cmd1 = 0x10;
		const cmd2 = 0x00;

		// Catching broadcast message
		this.once(
			[PacketID.StandardMessageReceived.toString(16), MessageSubtype.BroadcastMessage.toString(16)], 
			(data: Packets.StandardMessageRecieved) => {

				resolve({
					cat: data.to[0],
					subcat: data.to[1],
					firmware: data.to[2],
					hardward: data.cmd2
				})

			}
		);

		/* Sending command */
		this.sendInsteonCommand(cmd1, cmd2);
	});

	//#endregion

	//#region Linking

	public startRemoteLinking = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x09;
		const cmd2 = 0x01;
		const userData: Byte[] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		
		// Adding checksum
		userData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, userData));

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2, userData);
	}

	public stopRemoteLinking = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x08;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	//#endregion

	//#region Queue Functions

	private processQueue = async (task: DeviceCommandTask, callback: AsyncResultCallback<Packets.Packet>) => {

		/* Determining packet data */
		const isExtended = !!task.userData;
		const flag = task.flags ? task.flags 
		           : isExtended ? 0x1F
		           : 0x0F;

		const packetType = task.responsePacketType ? task.responsePacketType.toString(16)
		                 : isExtended              ? PacketID.ExtendedMessageReceived.toString(16)
		                                           : PacketID.StandardMessageReceived.toString(16);

		// Once we hear an echo (same command back) the modem is ready for another command
		this.modem.once(['p', packetType, '**'], d => {
			setTimeout(() => 
				callback(null, d)
			, 100); // Modem needs time to reset after command
			
		});

		// Attempting to write command to modem
		const isSuccessful = isExtended ? await this.modem.sendExtendedCommand(this.address, flag, task.cmd1, task.cmd2, task.userData)
		                                : await this.modem.sendStandardCommand(this.address, flag, task.cmd1, task.cmd2);

		if(!isSuccessful)
			callback(Error('Could not execute device packet'));
	}

	//#endregion

	// #region Event functions 

	private setupRebroadcast(){

		const addressString = this.address.map(num => num.toString(16).toUpperCase()).join('.');

		this.modem.on(['p', '*', '*', addressString, '**'], (data: Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved) => {

			const pType = data.type === PacketID.StandardMessageReceived ? 'S'
			            : data.type === PacketID.ExtendedMessageReceived ? 'E'
			            : 'U';

			console.log(`Device Packet [${pType}]: ${data.Flags.Subtype}`);

			this.emit([data.type.toString(16), data.Flags.subtype.toString(16)], data);
		});

	}

	//#endregion
}