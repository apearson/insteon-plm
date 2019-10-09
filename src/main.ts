/* Libraries */
import { EventEmitter2 } from 'eventemitter2';
import SerialPort from 'serialport';
import { queue, AsyncQueue, AsyncResultCallback } from 'async';
import { InsteonParser, Packets } from 'insteon-packet-parser';
import { toHex } from './utils';
import deviceDB from './deviceDB.json';

/* Devices */
import InsteonDevice from './devices/InsteonDevice';
import OutletLinc from './devices/OutletLinc';
import KeypadDimmer from './devices/KeypadDimmer';

/* Interfaces and Types */
import { PacketID, Byte, AllLinkRecordOperation, AllLinkRecordType, MessageSubtype } from 'insteon-packet-parser';

/* Library Exports */
export { Packets, PacketID, Byte, AllLinkRecordOperation, AllLinkRecordType, MessageSubtype };

/* Devices Import/Exports */
export { InsteonDevice, OutletLinc, KeypadDimmer };

//#region Interfaces

export interface ModemOptions {
	debug: boolean;
}

export interface ModemInfo{
	id: Byte[];
	devcat: Byte;
	subcat: Byte;
	firmware: Byte;
}

export interface ModemConfig{
	autoLinking: boolean;
	monitorMode: boolean;
	autoLED: boolean;
	deadman: boolean;
}

export interface QueueTaskData {
	command: Buffer;
	retries?: number;
}

//#endregion

//#region PLM Class

export default class PLM extends EventEmitter2{

	//#region Private Variables

	/* Internal Variables */
	private requestQueue: AsyncQueue<QueueTaskData>;

	/* Linking */
	private _links: Packets.AllLinkRecordResponse[][] = [];

	/* Internal Data holder */
	private _info: ModemInfo = {
		id: [0x00,0x00,0x00],
		devcat: 0x00,
		subcat: 0x00,
		firmware: 0x00
	};
	private _config: ModemConfig = {
		autoLinking: false,
		autoLED: false,
		deadman: false,
		monitorMode: false
	};

	/* Serial Port Options */
	private port: SerialPort;
	private parser: InsteonParser;

	/* Debug */
	private options: ModemOptions = { debug: false };

	//#endregion

	//#region Public Variables

	public connected = false;

	//#endregion

	//#region Constuctor

	constructor(portPath: string, options?: ModemOptions){
		/* Constructing super class */
		super({ wildcard: true, delimiter: '::' });

		/* Saving options */
		if(options)
			this.options = options;

		/* Opening serial port */
		this.port = new SerialPort(portPath, {
			lock: false,
			baudRate: 19200,
			dataBits: 8,
			stopBits: 1,
			parity: 'none'
		});

		/* Creating new parser */
		this.parser = new InsteonParser({ debug: false, objectMode: true });

		/* Porting serial port to parser */
		this.port.pipe(this.parser);

		/* Waiting for serial port to open */
		this.port.on('open', this.handlePortOpen);
		this.port.on('error', this.handlePortError);
		this.port.on('close', this.handlePortClose);

		/* On Packet */
		this.parser.on('data', this.handlePacket);

		/* Setting up request queue */
		this.requestQueue = queue(this.processQueue, 1);
	}

	//#endregion

	//#region Modem Metadata

	get info(){ return this._info; }

	get config(){ return this._config; }

	get links(){ return this._links; }

	//#endregion

	//#region Utility Methods

	public async deleteLink(deviceID: string | Byte[], groupID: Byte, type: AllLinkRecordType) {
		/* Parsing out device ID */
		if(typeof deviceID === 'string' ){
			deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
		}

		/* Deleting link from modem */
		const status = await this.manageAllLinkRecord(deviceID, groupID, AllLinkRecordOperation.DeleteFirstFound, type, [0x00, 0x00, 0x00]);

		/* Resyncing links if successful */
		status? await this.syncLinks() : null;

		/* Returning if delete was success or not */
		return status;
	}

	public async addLink(deviceID: string | Byte[], groupID: Byte, type: AllLinkRecordType) {
		/* Parsing out device ID */
		if(typeof deviceID === 'string' ){
			deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
		}

		// Putting the modem into linking mode
		this.startLinking(type, groupID);

		// Put the device into linking mode
		// InsteonDevice.startRemoteLinking(this, deviceID);
	}

	//#endregion

	//#region Modem Info

	public getInfo = () => new Promise<ModemInfo>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetIMInfo;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.GetIMInfo) => resolve({
					id: p.ID,
					firmware: p.firmware,
					devcat: p.devcat,
					subcat: p.subcat
				}))
				.catch(reject);	
	});

	public getConfig = () => new Promise<ModemConfig>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetIMConfiguration;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.GetIMConfiguration) => resolve({
					autoLED: p.Flags.autoLED,
					autoLinking: p.Flags.autoLinking,
					deadman: p.Flags.deadman,
					monitorMode: p.Flags.monitorMode
				}))
				.catch(reject);	
	});

	public async getAllLinks(): Promise<Packets.AllLinkRecordResponse[][]>{
		/* Creating an array of 255 groups filled with empty arrays */
		let groups = [...Array(255).keys()].map(i => Array(0));
		let index = 0;

		/* Getting first record */
		let record = await this.getFirstAllLinkRecord();

		/* Checking if first record exists */
		if(typeof record != 'boolean'){
			/* Removing extra data */
			record.type = undefined;
			record.typeDesc = undefined;

			/* Adding extra data */
			record.index = index;
			index++;

			/* Adding record to group */
			groups[record.allLinkGroup].push(record);
		}

		/* While there are more records get them */
		while(typeof record != 'boolean'){
			record = await this.getNextAllLinkRecord();

			/* Checking if retrieved record exists */
			if(typeof record != 'boolean'){
				/* Removing extra data */
				record.type = undefined;
				record.typeDesc = undefined;

				/* Adding extra data */
				record.index = index;
				index++;

				/* Adding record to group */
				groups[record.allLinkGroup].push(record);
			}
		}

		return groups;
	}
	

	//#endregion

	//#region Modem Sync

	public async syncInfo(){
		this._info = await this.getInfo();

		return this.info;
	}

	public async syncConfig(){
		this._config = await this.getConfig();

		return this.config;
	}

	public async syncLinks(){
		this._links = await this.getAllLinks();

		return this.links;
	}

	//#endregion

	//#region Modem Control

	public setConfig  = (autoLinking: boolean, monitorMode: boolean, autoLED: boolean, deadman: boolean) => new Promise<boolean>((resolve, reject) => {
		/* Configuration byte */
		let flagByte = 0x00;

		if(!autoLinking) flagByte |= 0x80;  //1000 0000
		if(monitorMode)  flagByte |= 0x40;  //0100 0000
		if(!autoLED)     flagByte |= 0x20;  //0010 0000
		if(!deadman)     flagByte |= 0x10;  //0001 0000

		/* Allocating command buffer */
		const command = PacketID.SetIMConfiguration
		const commandBuffer = Buffer.alloc(3);

		/* Creating command */
		commandBuffer.writeUInt8(0x02,     0); //PLM Command
		commandBuffer.writeUInt8(command,  1); //Set IM Configuration
		commandBuffer.writeUInt8(flagByte, 2); //IM Configuration Flags

		const onAck = (data: Packets.SetIMConfiguration) => resolve(data.ack);

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.SetIMConfiguration) => resolve(p.ack))
				.catch(reject);	
	});

	public setCategory = (cat: Byte, subcat: Byte, firmware: Byte = 0xff) => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.SetHostDeviceCategory;
		const commandBuffer = Buffer.alloc(5);

		/* Creating command */
		commandBuffer.writeUInt8(0x02,     0); //PLM Command
		commandBuffer.writeUInt8(command,  1); //Set Cat and Subcat
		commandBuffer.writeUInt8(cat,      2); //Cat
		commandBuffer.writeUInt8(subcat,   3); //Subcat
		commandBuffer.writeUInt8(firmware, 4); //Legacy Firmware version

		const onAck = (data: Packets.SetHostDeviceCategory) => resolve(data.ack);

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.SetHostDeviceCategory) => resolve(p.ack))
				.catch(reject);	
	});

	public setLed = (state: boolean) => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = state ? PacketID.LEDOn : PacketID.LEDOff;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		const onAck = (data: Packets.LEDOn | Packets.LEDOff) => resolve(data.ack);

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.LEDOn | Packets.LEDOff) => resolve(p.ack))
				.catch(reject);	
	});

	public sleep = () => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.RFSleep;
		const commandBuffer = Buffer.alloc(4);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //RF Sleep Byte
		commandBuffer.writeUInt8(0x00, 2);    //Command 1 of Ack (Reason for sleep)
		commandBuffer.writeUInt8(0x00, 3);    //Command 2 of Ack (Reason for sleep)

		/* Sending command */
		this.queueCommand(commandBuffer).then((data) => data.ack).catch(reject);	
	});

	public wake = () => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const commandBuffer = Buffer.alloc(1);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0); //PLM Command

		/* Sending command */
		this.queueCommand(commandBuffer);

		/* Responding after wake up */
		setTimeout(()=> resolve(true) , 40);
	});

	/**
	 *
	 * Resets the Insteon PowerLinc Modem.
	 *
	 * WARNING: This erases all links and data!
	 */
	public reset = () => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.ResetIM;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Reset Byte

		const onAck = (data: Packets.ResetIM) => resolve(data.ack);

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.ResetIM) => resolve(p.ack))
				.catch(reject);	
	});
	

	public close(){
		return (this.port.isOpen) ? this.port.close()
		                           : true;
	}

	//#endregion

	//#region All Link Commands

	public manageAllLinkRecord = (deviceID: string | Byte[], group: Byte, operation: AllLinkRecordOperation, type: AllLinkRecordType, linkData: Byte[]) => new Promise<boolean>((resolve, reject) => {
		/* Parsing out device ID */
		if(typeof deviceID === 'string' ){
			deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
		}

		/* Calulating flags needed */
		const flags = 0x40 & (type << 6); //1000 0000 & 0100 0000

		/* Allocating command buffer */
		const command = PacketID.ManageAllLinkRecord;
		const commandBuffer = Buffer.alloc(11);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);         //PLM Command
		commandBuffer.writeUInt8(command, 1);      //Modify All link record
		commandBuffer.writeUInt8(operation, 2);    //Modify First Controller Found or Add
		commandBuffer.writeUInt8(flags, 3);        //Flags
		commandBuffer.writeUInt8(group, 4);        //Group
		commandBuffer.writeUInt8(deviceID[0], 5);  //ID
		commandBuffer.writeUInt8(deviceID[1], 6);  //ID
		commandBuffer.writeUInt8(deviceID[2], 7);  //ID
		commandBuffer.writeUInt8(linkData[0], 8);  //Link Data 1
		commandBuffer.writeUInt8(linkData[1], 9);  //Link Data 2
		commandBuffer.writeUInt8(linkData[2], 10); //Link Data 3

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.ManageAllLinkRecord) => resolve(p.ack))
				.catch(reject);	
	});

	public startLinking = (type: AllLinkRecordType, group: Byte) => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.StartAllLinking;
		const commandBuffer = Buffer.alloc(4);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Start Linking Byte
		commandBuffer.writeUInt8(type, 2);    //Link Code
		commandBuffer.writeUInt8(group, 3);   //Group

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.StartAllLinking) => resolve(p.ack))
				.catch(reject);	
	});

	public cancelLinking = () => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.CancelAllLinking;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Start Linking Byte

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.CancelAllLinking) => resolve(p.ack))
				.catch(reject);	
	});

	public getFirstAllLinkRecord = () => new Promise<Packets.AllLinkRecordResponse | false>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetFirstAllLinkRecord;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		const onData = (data: Packets.AllLinkRecordResponse) => resolve(data);
		const onAck = (data: Packets.GetFirstAllLinkRecord) => {
			// If database is empty then remove listener and return a false
			if(!data.ack){
				this.removeListener(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);
				
				resolve(false);
			}
		};

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);
		this.once(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);

		/* Sending command */
		this.queueCommand(commandBuffer);
	});

	public getNextAllLinkRecord = () => new Promise<Packets.AllLinkRecordResponse | false>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetNextAllLinkRecord;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		const onData = (data: Packets.AllLinkRecordResponse) => resolve(data);
		const onAck = (data: Packets.GetNextAllLinkRecord) => {
			// If database is empty then remove listener and return a false
			if(!data.ack){
				this.removeListener(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);
				
				resolve(false);
			}
		};

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);
		this.once(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);

		/* Sending command */
		this.queueCommand(commandBuffer);
	});


	//#endregion

	//#region Send Commands

	public sendAllLinkCommand = (group: Byte, cmd1: Byte, cmd2: Byte) => new Promise<boolean>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.SendAllLinkCommand;
		const commandBuffer = Buffer.alloc(5);

		/* Creating command */
		commandBuffer.writeUInt8(0x02,  0);  //PLM Command
		commandBuffer.writeUInt8(command, 1);  //Standard Length Message
		commandBuffer.writeUInt8(group, 2);  //Device High Address Byte
		commandBuffer.writeUInt8(cmd1,  3);  //Device Middle Address Byte
		commandBuffer.writeUInt8(cmd2,  4);  //Device Low Address Byte

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.SendAllLinkCommand) => resolve(p.ack))
				.catch(reject);	
	});

	public sendStandardCommand = (deviceID: string | Byte[], flags: Byte = 0x0F, cmd1: Byte = 0x00, cmd2: Byte = 0x00) => new Promise<Packets.SendInsteonMessage>((resolve, reject) => {
		/* Parsing out device ID */
		if(typeof deviceID === 'string' ){
			deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
		}

		/* Allocating command buffer */
		const command = PacketID.SendInsteonMessage;
		const commandBuffer = Buffer.alloc(8);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);  //PLM Command
		commandBuffer.writeUInt8(command, 1);  //Standard Length Message
		commandBuffer.writeUInt8(deviceID[0], 2); //Device High Address Byte
		commandBuffer.writeUInt8(deviceID[1], 3); //Device Middle Address Byte
		commandBuffer.writeUInt8(deviceID[2], 4); //Device Low Address Byte
		commandBuffer.writeUInt8(flags, 5); //Message Flag Byte
		commandBuffer.writeUInt8(cmd1, 6);  //Command Byte 1
		commandBuffer.writeUInt8(cmd2, 7);  //Command Byte 2

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.SendInsteonMessage) => resolve(p))
				.catch(reject);	
	});

	public sendExtendedCommand = (deviceID: string | Byte[], flags: Byte = 0x1F, cmd1: Byte = 0x00, cmd2: Byte = 0x00, userData: Byte[]) => new Promise<Packets.SendInsteonMessage>((resolve, reject) => {
		/* Parsing out device ID */
		if(typeof deviceID === 'string' ){
			deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
		}

		/* Allocating command buffer */
		const command = PacketID.SendInsteonMessage;
		const commandBuffer = Buffer.alloc(22);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);  //PLM Command
		commandBuffer.writeUInt8(command, 1);  //Standard Length Message
		commandBuffer.writeUInt8(deviceID[0], 2); //Device High Address Byte
		commandBuffer.writeUInt8(deviceID[1], 3); //Device Middle Address Byte
		commandBuffer.writeUInt8(deviceID[2], 4); //Device Low Address Byte
		commandBuffer.writeUInt8(flags, 5); //Message Flag Byte
		commandBuffer.writeUInt8(cmd1, 6);  //Command Byte 1
		commandBuffer.writeUInt8(cmd2, 7);  //Command Byte 2
		commandBuffer.writeUInt8(userData[0]  || 0x00, 8);  //User Data 1
		commandBuffer.writeUInt8(userData[1]  || 0x00, 9);  //User Data 2
		commandBuffer.writeUInt8(userData[2]  || 0x00, 10);  //User Data 3
		commandBuffer.writeUInt8(userData[3]  || 0x00, 11);  //User Data 4
		commandBuffer.writeUInt8(userData[4]  || 0x00, 12);  //User Data 5
		commandBuffer.writeUInt8(userData[5]  || 0x00, 13);  //User Data 6
		commandBuffer.writeUInt8(userData[6]  || 0x00, 14);  //User Data 7
		commandBuffer.writeUInt8(userData[7]  || 0x00, 15);  //User Data 8
		commandBuffer.writeUInt8(userData[8]  || 0x00, 16);  //User Data 9
		commandBuffer.writeUInt8(userData[9]  || 0x00, 17);  //User Data 10
		commandBuffer.writeUInt8(userData[10] || 0x00, 18);  //User Data 11
		commandBuffer.writeUInt8(userData[11] || 0x00, 19);  //User Data 12
		commandBuffer.writeUInt8(userData[12] || 0x00, 20);  //User Data 13
		commandBuffer.writeUInt8(userData[13] || 0x00, 21);  //User Data 14

		/* Sending command */
		this.queueCommand(commandBuffer)
				.then((p: Packets.SendInsteonMessage) => resolve(p))
				.catch(reject);	
	});

	//#endregion

	//#region Queue Functions

	private processQueue = async (task: QueueTaskData, callback: AsyncResultCallback<Packets.Packet>) => {

		// Once we hear an echo (same command back) the modem is ready for another command
		this.once(['p', task.command[1].toString(16)], (d: Packets.Packet) => {
			if(d.ack){
				const packet = d as Packets.SendInsteonMessage;
					
				if(packet.ack){
					callback(null, packet);
				}
				else{
					if(task.retries && task.retries > 2){
						callback(Error('Could not complete task'));
					}
					else{
						task.retries = (task.retries || 0) + 1;

						this.requestQueue.push(task, callback);
					}
				}
			}
			else{
				callback(null, d)
			}
		});

		// Attempting to write command to modem
		try{
			const isSuccessful = await this.port.write(task.command);
			
			if(!isSuccessful)
				callback(Error('Could not write to modem'));
		}
		catch(error){
			callback(error);
		}
	}

	private queueCommand = (command: Buffer) => new Promise<Packets.Packet>((resolve, reject) => {

		this.requestQueue.push({ command }, (error, data: Packets.Packet) => {
			error ? reject(error) : resolve(data);
		});
	});

	//#endregion

	//#region Port Handlers

	private handlePortOpen = async () => {
		/* Updating connected */
		this.connected = true;

		/* Emitting connected and syncing */
		this.emit('connected');
		this.emit(['e', 'connected']);

		/* Inital Sync of info */
		await this.syncInfo();
		await this.syncConfig();
		await this.syncLinks();

		/* Emitting ready */
		this.emit('ready');
		this.emit(['e', 'ready']);
	}

	private handlePortError = (error: Error)=>{
		/* Updating connected */
		this.connected = this.port.isOpen;

		/* Emitting error */
		this.emit('error', error);
		this.emit(['e', 'error'], error);
	}

	private handlePortClose = ()=>{
		/* Updating connected */
		this.connected = false;

		/* Emitting disconnect */
		this.emit('disconnected');
		this.emit(['e', 'disconnected']);
	}

	//#endregion

	//#region Packet Handlers

	private handlePacket = (packet: Packets.Packet) => {

		/* Emitting packet for others to use */
		this.emit('packet', packet);

		if(this.options.debug){
			if(packet.type === PacketID.SendInsteonMessage){
				console.log(`[${packet.Type}]: ${toHex(packet.cmd1)} ${toHex(packet.cmd2)}`);	
			}
			else if(packet.type === PacketID.ExtendedMessageReceived){
				console.log(`[${packet.Type}]: ${toHex(packet.cmd1)} ${toHex(packet.cmd2)} ${(packet.extendedData).map(toHex)}`);	
			}
			else{
				console.log(`[${packet.Type}]: ${toHex(packet.cmd1)} ${toHex(packet.cmd2)}`);
			}
		}

		/* Checking if packet if from a device */
		if(packet.type === PacketID.StandardMessageReceived || packet.type === PacketID.ExtendedMessageReceived){
			let p = packet as Packets.StandardMessageRecieved;

			const deviceID = p.from.map(num => num.toString(16).toUpperCase()).join('.');

			this.emit(['p', p.type.toString(16), p.Flags.subtype.toString(16) , deviceID], p);
		}
		else {
			this.emit(['p', packet.type.toString(16)], packet);
		}
	}

	//#endregion

	//#region Static Methods

	public static async getPlmDevices(){
		const devices = await SerialPort.list();

		return devices.filter(d => d.vendorId === '0403' && d.productId === '6001');
	}

	public static getDeviceInfo = (cat: Byte, subcat: Byte) =>
		deviceDB.devices.find(d => Number(d.cat) === cat && Number(d.subcat) === subcat);

	public static addressToAddressString = (address: Byte[]) =>
		address.map(num => num.toString(16).toUpperCase()).join('.');

	//#endregion
};

//#endregion
