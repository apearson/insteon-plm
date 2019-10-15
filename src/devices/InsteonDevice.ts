/* Libraries */
import { EventEmitter2 } from 'eventemitter2';
import { queue, AsyncQueue, AsyncResultCallback } from 'async';
import PowerLincModem from '../PowerLincModem';
import { Byte, PacketID, Packets, MessageSubtype, AllLinkRecordType } from 'insteon-packet-parser'
import { toHex } from '../utils';

/* Interface */
export interface DeviceCommandTask {
	cmd1: Byte;
	cmd2: Byte;
	flags?: Byte;
	userData?: Byte[];
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
	address: Byte[];
	type: Byte;
	Type: {
		active: boolean;
		control: AllLinkRecordType;
		smartHop: number;
		highWater: boolean;
	};
	group: Byte;
	device: Byte[];
	onLevel: Byte;
	rampRate: Byte;
}
export interface DeviceLinkRecordOptions {
	group: Byte;
	device: Byte[];
	onLevel: Byte;
	rampRate: Byte;
	Type: {
		active?: boolean;
		control: AllLinkRecordType;
		smartHop?: Byte;
		highwater?: boolean;
	}
}

/* Class for Insteon Devices */
export default class InsteonDevice extends EventEmitter2 {

	//#region Private Variables

	/* Class Info */
	public address: Byte[];

	/* Device Info */
	public cat: Byte = 0x00;
	public subcat: Byte = 0x00;
	public firmware: Byte = 0x00;
	public hardward: Byte = 0x00;
	public links: DeviceLinkRecord[] = [];

	/* Inernal Variaables */
	public modem: PowerLincModem;
	public requestQueue: AsyncQueue<DeviceCommandTask>;
	public options: DeviceOptions = { debug: false };

	//#endregion

	//#region Constuctor

	constructor(deviceID: Byte[], modem: PowerLincModem, options?: DeviceOptions){
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

	get addressString(){ return PowerLincModem.addressToAddressString(this.address); }

	//#endregion

	//#region Utility Method

	public static calulateChecksum(cmd1: Byte, cmd2: Byte, userData: Byte[]): Byte{
		// Summing bytes
		let sum = [cmd1, cmd2, ...userData].reduce((acc, v) => (acc += v) as Byte, 0);

		let lastByte = sum & 0xFF;

		let compliment = -lastByte;
		
		let sign2unsigned = (compliment >>> 0) & 0xFF;

		return sign2unsigned as Byte;
	}

	//#endregion

	//#region Insteon Send Methods

	public sendInsteonCommand = (cmd1: Byte, cmd2: Byte, userData?: Byte[], flags?: Byte) => new Promise<Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved>((resolve, reject) => {

		/* Sending command */
		this.requestQueue.push({cmd1, cmd2, userData, flags }, (err?: Error | null, data?: Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved) => {
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

	//#region Higher Level Methods

	// Reading entire database
	public getDatabase = () => 
		this.readDatabase([0x0F, 0xFF], 0x00);

	// Get device info and parse info out of packet
	public async getDeviceInfo(){

		const data = await this.idRequest();

		const deviceInfo: DeviceInfo = {
			cat: data.to[0],
			subcat: data.to[1],
			firmware: data.to[2],
			hardward: data.cmd2
		};

		return deviceInfo;
	}

	//#endregion

	//#region Raw Metadata Commands 

	public productDataRequest(): Promise<Packets.StandardMessageRecieved>{
		
		// Setting up command
		const cmd1 = 0x03;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}
	
	public getEngineVersion(): Promise<Packets.StandardMessageRecieved>{

		// Setting up command
		const cmd1 = 0x0D;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public idRequest = () => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {

		// Catching broadcast message
		this.once(
			[PacketID.StandardMessageReceived.toString(16), MessageSubtype.BroadcastMessage.toString(16)], 
			(data: Packets.StandardMessageRecieved) => resolve(data)
		);

		// Setting up command
		const cmd1 = 0x10;
		const cmd2 = 0x00;

		/* Sending command */
		this.sendInsteonCommand(cmd1, cmd2);
	});

	//#endregion

	//#region Raw Commands 

	public ping(): Promise<Packets.StandardMessageRecieved>{

		// Setting up command
		const cmd1 = 0x0F;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	// TODO: NotImplimented
	public allLinkRecall = () => { }

	//#endregion

	//#region Linking

	public assignToGroup(group: Byte): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x01;
		const cmd2 = group;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public deleteFromGroup(group: Byte): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x02;
		const cmd2 = group;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	public enterLinking(): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x09;
		const cmd2 = 0x01;
		const userData: Byte[] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		
		// Adding checksum
		userData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, userData));

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2, userData);
	}

	public enterUnlinking(group: Byte): Promise<Packets.StandardMessageRecieved> {

		// Setting up command
		const cmd1 = 0x0A;
		const cmd2 = group;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	//#endregion

	//#region Database Commands
	
	public readDatabase = (startAddress: Byte[], numberOfRecords: Byte) => new Promise<DeviceLinkRecord[]>(async (resolve, reject) => {

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
				address: [data.extendedData[2], data.extendedData[3]],
				type,
				Type: {
					active: !!((type & 128) >> 7),
					control: (type & 64) >> 6,
					smartHop: (type & 24) >> 3,
					highWater: !((type & 2) >> 1)
				},
				group: data.extendedData[6],
				device: [data.extendedData[7], data.extendedData[8], data.extendedData[9]],
				onLevel: data.extendedData[10],
				rampRate: data.extendedData[11]
			};

			// If link is a highwater mark then remove listener and fullfil promise, else add link to cache
			if(link.Type.highWater){
				this.removeListener(dbRecordEvent, handleDbRecordResponse);

				links.push(link);
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
		const userData: Byte[] = [0x00, 0x00, startAddress[0], startAddress[1], numberOfRecords, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

		/* Sending command */
		this.sendInsteonCommand(cmd1, cmd2, userData);
	});

	public modifyDatabase(address: Byte[], options: DeviceLinkRecordOptions){

		// General Info
		const group = options.group;
		const device = options.device;
		const onLevel = options.onLevel;
		const rampRate = options.rampRate;

		// Flags
		const active = options.Type.active || true;
		const type = options.Type.control;
		const smartHop = options.Type.smartHop || 3;
		const highWater = options.Type.highwater || false;

		// Creating flag bit
		const flags = ((+active << 7) | (type << 6) | (1 << 5) | (smartHop << 3) | (+(!highWater) << 1)) as Byte;

		console.log(highWater, flags.toString(2));

		// Setting up command
		const cmd1 = 0x2F;
		const cmd2 = 0x00;
		const numberOfBytes = 0x08;

		// Creating user data
		const userData: Byte[] = [0x00, 0x02, address[0], address[1], numberOfBytes, flags, group, device[0], device[1], device[2], onLevel, rampRate, 0x00];

		// Pushing checksum onto user data
		userData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, userData));

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2, userData);
	}
	
	//#endregion

	//#region Queue Functions

	private processQueue = async (task: DeviceCommandTask, callback: AsyncResultCallback<Packets.Packet>) => {

		/* Determining packet data */
		const isExtended = !!task.userData;
		const flag = task.flags ? task.flags 
		           : isExtended ? 0x1F
		           : 0x0F;

		const callbackFunction = (d: Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved) => {

			// Removing any listeners
			this.modem.removeListener(['p', '*',  MessageSubtype.ACKofDirectMessage.toString(16), '**'], callbackFunction);
			this.modem.removeListener(['p', '*',  MessageSubtype.NAKofDirectMessage.toString(16), '**'], callbackFunction);

			// Calling callback after cooldown
			setTimeout(() =>
				callback(null, d)
			, 200); // Modem needs time to reset after command
		};

		// Once we hear an echo (same command back) the modem is ready for another command
		this.modem.once(['p', '*',  MessageSubtype.ACKofDirectMessage.toString(16), '**'], callbackFunction);
		this.modem.once(['p', '*',  MessageSubtype.NAKofDirectMessage.toString(16), '**'], callbackFunction);

		if(this.options.debug)
		{
			let consoleLine = `[→][${this.addressString}][${isExtended? 'E':'S'}]: Flag: ${toHex(flag)} | Cmd: ${toHex(task.cmd1)} ${toHex(task.cmd2)}`;		

			if(task.userData)
				consoleLine += ` | UserData: ${(task.userData || []).map(toHex)}`
			
			console.log(consoleLine);
		}
		// Attempting to write command to modem
		const isSuccessful = !!task.userData ? await this.modem.sendExtendedCommand(this.address, flag, task.cmd1, task.cmd2, task.userData)
		                                     : await this.modem.sendStandardCommand(this.address, flag, task.cmd1, task.cmd2);

		if(!isSuccessful)
			callback(Error('Could not execute device packet'));
	}

	//#endregion

	//#region Event functions 

	public setupRebroadcast(){

		this.modem.on(['p', '*', '*', this.addressString, '**'], (data: Packets.StandardMessageRecieved | Packets.ExtendedMessageRecieved) => {

			const pType = data.type === PacketID.StandardMessageReceived ? 'S'
			            : data.type === PacketID.ExtendedMessageReceived ? 'E'
			            : 'U';

			if(this.options.debug)
				console.log(`[←][${this.addressString}][${pType}][${data.Flags.Subtype}]: ${toHex(data.cmd1)} ${toHex(data.cmd2)} ${(data.extendedData || []).map(toHex)}`);

			this.emit([data.type.toString(16), data.Flags.subtype.toString(16)], data);
		});

	}

	//#endregion
}