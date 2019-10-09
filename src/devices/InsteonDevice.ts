/* Libraries */
import { EventEmitter2 } from 'eventemitter2';
import { queue, AsyncQueue, AsyncResultCallback } from 'async';
import PLM, { Byte, PacketID, Packets, MessageSubtype, AllLinkRecordType } from '../main';
import { toHex } from '../utils';

/* Types */

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
export interface DeviceOptions {
	debug: boolean;
}
export interface DeviceLinkRecord {
	address: string[];
	type: Byte;
	Type: {
		active: boolean;
		control: string;
		smartHop: number;
		highWater: boolean;
	};
	group: Byte;
	device: string[];
	onLevel: Byte;
	rampRate: Byte;
}

/* Abstract class for Insteon Devices */
export default class InsteonDevice extends EventEmitter2 {

	//#region Private Variables

	/* Class Info */
	protected address: Byte[];

	/* Device Info */
	public cat: Byte;
	public subcat: Byte;
	public firmware: Byte;
	public hardward: Byte;
	public links: DeviceLinkRecord[] = [];

	/* Inernal Variaables */
	protected modem: PLM;
	private requestQueue: AsyncQueue<DeviceCommandTask>;
	protected options: DeviceOptions = { debug: false };

	//#endregion

	//#region Constuctor

	constructor(deviceID: Byte[], modem: PLM, options?: DeviceOptions){
		super({ wildcard: true, delimiter: '::' });

		/* Saving serialport */
		this.modem = modem;

		/* Saving options */
		if(options)
			this.options = options;

		/* Setting up info */
		this.address = deviceID;

		/* Setting up request queue */
		this.requestQueue = queue(this.processQueue, 1);

		/* Setting up packet rebroadcasting */
		this.setupRebroadcast();

		/* Initalizing Device */
		this.initalize()
	}

	public async initalize(){

		// Syncing data		
		await this.syncInfo();
		await this.syncLinks();

		/* Emitting ready event */
		this.emit('ready');
	}

	//#endregion

	//#region Device Metadata

	get addressString(){ return PLM.addressToAddressString(this.address); }

	//#endregion

	//#region Utility Method

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

	//#endregion

	//#region Device Sync

	public async syncInfo(){
		// Getting info from device
		const info = await this.getDeviceInfo();

		/* Saving device info */
		this.cat = info.cat;
		this.subcat = info.subcat;
		this.firmware = info.firmware;
		this.hardward = info.hardward;

		// Returning device info
		return info;
	}

	public async syncLinks(){
		// Getting links from device
		this.links = await this.getDatabase();

		// Returning device links
		return this.links;
	}

	//#endregion

	//#region Insteon Methods

	public getEngineVersion = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x0D;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public ping = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x0F;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public getDeviceInfo = () => new Promise<DeviceInfo>((resolve, reject) => {

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

		// Setting up command
		const cmd1 = 0x10;
		const cmd2 = 0x00;

		/* Sending command */
		this.sendInsteonCommand(cmd1, cmd2);
	});

	public getDatabase = () => new Promise<DeviceLinkRecord[]>(async (resolve, reject) => {

		// Device links
		const links: DeviceLinkRecord[]  = [];

		// Device listener event name
		const dbRecordEvent = [PacketID.ExtendedMessageReceived.toString(16), MessageSubtype.DirectMessage.toString(16)];

		// Function to handle record response
		const handleDbRecordResponse = (data: Packets.ExtendedMessageRecieved) => {

			// Getting record type (Controller/Responder)
			const type = data.extendedData[5];
			
			// Creating link from data
			const link: DeviceLinkRecord = {
				address: [data.extendedData[2], data.extendedData[3]].map(toHex).map(e => e[0]),
				type,
				Type: {
					active: !!((type & 128) >> 7),
					control: AllLinkRecordType[(type & 64) >> 6],
					smartHop: (type & 24) >> 3,
					highWater: !((type & 2) >> 1)
				},
				group: data.extendedData[6],
				device: [data.extendedData[7], data.extendedData[8], data.extendedData[9]].map(toHex).map(e => e[0]),
				onLevel: data.extendedData[10],
				rampRate: data.extendedData[11]
			};

			// If link is a highwater mark then remove listener and fullfil promise, else add link to cache
			if(link.Type.highWater){
				this.removeListener(dbRecordEvent, handleDbRecordResponse);

				resolve(links);
			}
			else {
				links.push(link);
			}
	
		}

		// Catching broadcast message
		this.on(dbRecordEvent, handleDbRecordResponse);

		// Setting up command
		const cmd1 = 0x2F;
		const cmd2 = 0x00;
		const userData: Byte[] = [0x00, 0x00, 0x0F, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

		/* Sending command */
		this.sendInsteonCommand(cmd1, cmd2, userData);
	});

	public beep = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x30;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	//#endregion

	//#region Status

	public getStatus = (): Promise<Packets.StandardMessageRecieved> => {

		// Setting up command
		const cmd1 = 0x19;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

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
			, 200); // Modem needs time to reset after command
			
		});

		if(this.options.debug)
			console.log(`[${this.addressString}][${isExtended? 'E':'S'}]: Flag: 0x${flag.toString(16)} | Cmd1: 0x${task.cmd1.toString(16)} | Cmd2: 0x${task.cmd2.toString(16)} | UserData: ${task.userData}`);

		// Attempting to write command to modem
		const isSuccessful = isExtended ? await this.modem.sendExtendedCommand(this.address, flag, task.cmd1, task.cmd2, task.userData)
		                                : await this.modem.sendStandardCommand(this.address, flag, task.cmd1, task.cmd2);

		if(!isSuccessful)
			callback(Error('Could not execute device packet'));
	}

	//#endregion

	//#region Event functions 

	private setupRebroadcast(){

		this.modem.on(['p', '*', '*', this.addressString, '**'], (data: Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved) => {

			const pType = data.type === PacketID.StandardMessageReceived ? 'S'
			            : data.type === PacketID.ExtendedMessageReceived ? 'E'
			            : 'U';

			if(this.options.debug)
				console.log(`[${this.addressString}][${pType}][${data.Flags.Subtype}]: ${toHex(data.cmd1)} ${toHex(data.cmd2)} ${(data.extendedData || []).map(toHex)}`);

			this.emit([data.type.toString(16), data.Flags.subtype.toString(16)], data);
		});

	}

	//#endregion
}