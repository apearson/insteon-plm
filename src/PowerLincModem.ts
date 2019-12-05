/* Libraries */
import { EventEmitter2 } from 'eventemitter2';
import SerialPort from 'serialport';
import { queue, AsyncQueue, AsyncResultCallback } from 'async';
import { InsteonParser, Packet } from 'insteon-packet-parser';
import { toHex, toAddressString } from './utils';
import deviceDB from './deviceDB.json';
import Bluebird, { delay, promisify } from 'bluebird';

/* Generic Insteon Device */
import InsteonDevice, { DeviceOptions } from './devices/InsteonDevice';

/* Dimable Devices. Device cat 0x01 */
import DimmableLightingDevice from './devices/DimmableLightingDevice/DimmableLightingDevice';
import KeypadDimmer  from './devices/DimmableLightingDevice/KeypadDimmer';

/* Switched On/Off Devices. Device cat 0x02 */
import SwitchedLightingDevice from './devices/SwitchedLightingDevice/SwitchedLightingDevice';
import OutletLinc from './devices/SwitchedLightingDevice/OutletLinc';

/* Sensors and Actuators. Device cat 0x07 */
import SensorActuatorDevice from './devices/SensorActuatorDevice/SensorActuatorDevice';
import IOLinc from './devices/SensorActuatorDevice/IOLinc';

/* Security / battery operated sensors. Device cat 0x10 */
import SecurityDevice from './devices/SecurityDevice/SecurityDevice';
import MotionSensor from './devices/SecurityDevice/MotionSensor';
import OpenCloseSensor from './devices/SecurityDevice/OpenCloseSensor';
import LeakSensor from './devices/SecurityDevice/LeakSensor';

/* Interfaces and Types */
import { PacketID, Byte, AllLinkRecordOperation, AllLinkRecordType, AnyPacket, MessageSubtype } from 'insteon-packet-parser';
import { Device } from './typings/database';

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

export interface ModemLink {
	group: Byte;
	device: Byte[];
	type: AllLinkRecordType;
	linkData: Byte[];
}

interface QueueTaskData extends Buffer {
}

//#endregion

//#region PLM Class
export default class PowerLincModem extends EventEmitter2 {

	//#region Private Variables

	/* Internal Variables */
	private requestQueue: AsyncQueue<QueueTaskData>;
	private _queueCommand: (command: QueueTaskData) => Bluebird<Packet.Packet>;

	/* Linking */
	private _links: ModemLink[] = [];

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
		this._queueCommand = promisify(this.requestQueue.push)
	}

	//#endregion

	//#region Modem Metadata

	get info(){ return this._info; }

	get config(){ return this._config; }

	get links(){ return this._links; }

	get groups(){

		let groups = [...Array(255).keys()].map(i => [] as ModemLink[]);

		return this._links.filter(r => r.type === AllLinkRecordType.Controller)
		                  .reduce((arr, v, i) => {
		                  	arr[v.group].push(v);

		                  	return arr;
		                  }, groups);

	}

	get reponders(){
		return this._links.filter(r => r.type === AllLinkRecordType.Responder);
	}

	//#endregion

	//#region Utility Methods

	public async deleteLink(deviceID: string | Byte[], groupID: Byte, type: AllLinkRecordType){
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

	public async addLink(deviceID: string | Byte[], groupID: Byte, type: AllLinkRecordType){
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

	public async getInfo(){
		/* Allocating command buffer */
		const command = PacketID.GetIMInfo;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		/* Sending command */
		const p = await this.queueCommand(commandBuffer) as Packet.GetIMInfo;

		return p;
	}

	public async getConfig(){
		/* Allocating command buffer */
		const command = PacketID.GetIMConfiguration;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		/* Sending command */
		const p = await this.queueCommand(commandBuffer) as Packet.GetIMConfiguration;

		return p;
	}

	public async getAllLinks(): Promise<ModemLink[]>{

		let links: ModemLink[] = [];

		/* Getting first record */
		let record = await this.getFirstAllLinkRecord();

		/* Checking if first record exists */
		if(record !== null){

			let link: ModemLink = {
				group: record.allLinkGroup,
				device: record.from,
				type: record.Flags.recordType,
				linkData: record.linkData
			};

			/* Adding record to group */
			links.push(link);
		}

		/* While there are more records get them */
		while(record !== null){
			record = await this.getNextAllLinkRecord();

			/* Checking if retrieved record exists */
			if(record !== null){

				let link: ModemLink = {
					group: record.allLinkGroup,
					device: record.from,
					type: record.Flags.recordType,
					linkData: record.linkData
				};

				/* Adding record to group */
				links.push(link);
			}
		}

		return links;
	}

	//#endregion

	//#region Modem Sync

	public async syncInfo(){
		const info = await this.getInfo();

		this._info = {
			id: info.ID,
			devcat: info.devcat,
			subcat: info.subcat,
			firmware: info.firmware
		};

		return this.info;
	}

	public async syncConfig(){
		const config = await this.getConfig();

		this._config = {
			autoLED: config.Flags.autoLED,
			autoLinking: config.Flags.autoLinking,
			deadman: config.Flags.deadman,
			monitorMode: config.Flags.monitorMode
		};

		return this.config;
	}

	// TODO: Abtract away from packets
	public async syncLinks(){
		this._links= await this.getAllLinks();

		return this.links;
	}

	//#endregion

	//#region Modem Control

	public async setConfig(autoLinking: boolean, monitorMode: boolean, autoLED: boolean, deadman: boolean){
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

		/* Sending command */
		const ackPacket = await this.queueCommand(commandBuffer) as Packet.SetIMConfiguration;

		/* Returning ack */
		return ackPacket.ack;
	}

	public async setCategory(cat: Byte, subcat: Byte, firmware: Byte = 0xff){
		/* Allocating command buffer */
		const command = PacketID.SetHostDeviceCategory;
		const commandBuffer = Buffer.alloc(5);

		/* Creating command */
		commandBuffer.writeUInt8(0x02,     0); //PLM Command
		commandBuffer.writeUInt8(command,  1); //Set Cat and Subcat
		commandBuffer.writeUInt8(cat,      2); //Cat
		commandBuffer.writeUInt8(subcat,   3); //Subcat
		commandBuffer.writeUInt8(firmware, 4); //Legacy Firmware version

		/* Sending command */
		const ackPacket = await this.queueCommand(commandBuffer) as Packet.SetHostDeviceCategory;

		/* Returning ack */
		return ackPacket.ack;
	}

	public async setLed(state: boolean){
		/* Allocating command buffer */
		const command = state ? PacketID.LEDOn : PacketID.LEDOff;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		/* Sending command */
		const ackPacket = await this.queueCommand(commandBuffer) as Packet.LEDOn | Packet.LEDOff;

		/* Returning ack */
		return ackPacket.ack;
	}

	public async sleep(){
		/* Allocating command buffer */
		const command = PacketID.RFSleep;
		const commandBuffer = Buffer.alloc(4);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //RF Sleep Byte
		commandBuffer.writeUInt8(0x00, 2);    //Command 1 of Ack (Reason for sleep)
		commandBuffer.writeUInt8(0x00, 3);    //Command 2 of Ack (Reason for sleep)

		/* Sending command */
		const ackPacket = await this.queueCommand(commandBuffer) as Packet.RFSleep;

		/* Returning ack */
		return ackPacket.ack;
	}

	public async wake(){
		/* Allocating command buffer */
		const commandBuffer = Buffer.alloc(1);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0); //PLM Command

		/* Sending command */
		this.queueCommand(commandBuffer);

		/* Waiting 40 milliseconds for modem to wake up */
		await delay(40);

		/* Responding after wake up */
		return true;
	}

	/**
	 *
	 * Resets the Insteon PowerLinc Modem.
	 *
	 * WARNING: This erases all links and data!
	 */
	public async reset(){
		/* Allocating command buffer */
		const command = PacketID.ResetIM;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Reset Byte

		/* Sending command */
		const ackPacket = await this.queueCommand(commandBuffer) as Packet.RFSleep;

		/* Returning ack */
		return ackPacket.ack;
	}

	public close(){
		return this.port.isOpen ? this.port.close()
		                        : true;
	}

	//#endregion

	//#region All Link Commands

	public async manageAllLinkRecord(deviceID: string | Byte[], group: Byte, operation: AllLinkRecordOperation, type: AllLinkRecordType, linkData: Byte[]){
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
		const packet = await this.queueCommand(commandBuffer) as Packet.ManageAllLinkRecord;

		/* Returning ack of command */
		return packet.ack;
	}

	public async startLinking(type: AllLinkRecordType, group: Byte){
		/* Allocating command buffer */
		const command = PacketID.StartAllLinking;
		const commandBuffer = Buffer.alloc(4);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Start Linking Byte
		commandBuffer.writeUInt8(type, 2);    //Link Code
		commandBuffer.writeUInt8(group, 3);   //Group

		/* Sending command */
		const packet = await this.queueCommand(commandBuffer) as Packet.StartAllLinking;

		/* Returning ack of command */
		return packet.ack;
	}

	public async cancelLinking(){
		/* Allocating command buffer */
		const command = PacketID.CancelAllLinking;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);    //PLM Command
		commandBuffer.writeUInt8(command, 1); //Start Linking Byte

		/* Sending command */
		const packet = await this.queueCommand(commandBuffer) as Packet.CancelAllLinking;

		/* Returning ack of command */
		return packet.ack;
	}

	public getFirstAllLinkRecord = () => new Promise<Packet.AllLinkRecordResponse | null>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetFirstAllLinkRecord;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		const onData = (data: Packet.AllLinkRecordResponse) => resolve(data);
		const onAck = (data: Packet.GetFirstAllLinkRecord) => {
			// If database is empty then remove listener and return a false
			if(!data.ack){
				this.removeListener(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);

				resolve(null);
			}
		};

		/* Listening for reponse packet */
		this.once(['p', command.toString(16)], onAck);
		this.once(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);

		/* Sending command */
		this.queueCommand(commandBuffer);
	});

	public getNextAllLinkRecord = () => new Promise<Packet.AllLinkRecordResponse | null>((resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.GetNextAllLinkRecord;
		const commandBuffer = Buffer.alloc(2);

		/* Creating command */
		commandBuffer.writeUInt8(0x02, 0);
		commandBuffer.writeUInt8(command, 1);

		const onData = (data: Packet.AllLinkRecordResponse) => resolve(data);
		const onAck = (data: Packet.GetNextAllLinkRecord) => {
			// If database is empty then remove listener and return a false
			if(!data.ack){
				this.removeListener(['p', PacketID.AllLinkRecordResponse.toString(16)], onData);

				resolve(null);
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

	public sendAllLinkCommand = (group: Byte, cmd1: Byte, cmd2: Byte) => new Promise(async (resolve, reject) => {
		/* Allocating command buffer */
		const command = PacketID.SendAllLinkCommand;
		const commandBuffer = Buffer.alloc(5);

		/* Creating command */
		commandBuffer.writeUInt8(0x02,  0);    //PLM Command
		commandBuffer.writeUInt8(command, 1);  //Standard Length Message
		commandBuffer.writeUInt8(group, 2);    //Device High Address Byte
		commandBuffer.writeUInt8(cmd1,  3);    //Device Middle Address Byte
		commandBuffer.writeUInt8(cmd2,  4);    //Device Low Address Byte

		/* Sending command */
		const packet = await this.queueCommand(commandBuffer) as Packet.SendAllLinkCommand;

		if(!packet.ack)
			reject('Could not send all link command');

		/* Waiting on cleanup report */
		this.once(['p', PacketID.AllLinkCleanupStatusReport.toString(16)],
		          (d: Packet.AllLinkCleanupStatusReport) => resolve(d.status)
		);

		/* Returning ack of command */
		// return packet.ack;
	});

	public async sendStandardCommand(deviceID: string | Byte[], cmd1: Byte = 0x00, cmd2: Byte = 0x00, flags: Byte = 0x0F){
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
		const packet = await this.queueCommand(commandBuffer) as Packet.SendInsteonMessage;

		/* Returning ack of command */
		return packet.ack;
	}

	public async sendExtendedCommand(deviceID: string | Byte[], cmd1: Byte = 0x00, cmd2: Byte = 0x00, extendedData: Byte[], flags: Byte = 0x1F){
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
		commandBuffer.writeUInt8(extendedData[0]  || 0x00, 8);  //User Data 1
		commandBuffer.writeUInt8(extendedData[1]  || 0x00, 9);  //User Data 2
		commandBuffer.writeUInt8(extendedData[2]  || 0x00, 10);  //User Data 3
		commandBuffer.writeUInt8(extendedData[3]  || 0x00, 11);  //User Data 4
		commandBuffer.writeUInt8(extendedData[4]  || 0x00, 12);  //User Data 5
		commandBuffer.writeUInt8(extendedData[5]  || 0x00, 13);  //User Data 6
		commandBuffer.writeUInt8(extendedData[6]  || 0x00, 14);  //User Data 7
		commandBuffer.writeUInt8(extendedData[7]  || 0x00, 15);  //User Data 8
		commandBuffer.writeUInt8(extendedData[8]  || 0x00, 16);  //User Data 9
		commandBuffer.writeUInt8(extendedData[9]  || 0x00, 17);  //User Data 10
		commandBuffer.writeUInt8(extendedData[10] || 0x00, 18);  //User Data 11
		commandBuffer.writeUInt8(extendedData[11] || 0x00, 19);  //User Data 12
		commandBuffer.writeUInt8(extendedData[12] || 0x00, 20);  //User Data 13
		commandBuffer.writeUInt8(extendedData[13] || 0x00, 21);  //User Data 14

		/* Sending command */
		const packet = await this.queueCommand(commandBuffer) as Packet.SendInsteonMessage;

		/* Returning ack of command */
		return packet.ack;
	}

	//#endregion

	//#region Queue Functions

	private processQueue = async (task: QueueTaskData, callback: AsyncResultCallback<AnyPacket>) => {

		// Once we hear an echo (same command back) the modem is ready for another command
		this.once(['p', task[1].toString(16)], (d: Packet.Packet) => {
			if(d.ack){
				const packet = d as Packet.SendInsteonMessage;

				if(packet.ack){
					callback(null, packet);
				}
				else{
					callback(Error('Could not complete task'));
				}
			}
			else{
				callback(null, d)
			}
		});

		// Attempting to write command to modem
		try{
			const isSuccessful = this.port.write(task);

			if(!isSuccessful)
				callback(Error('Could not write to modem'));
		}
		catch(error){
			callback(error);
		}
	}

	// Queues the command with a timeout
	private queueCommand(command: Buffer){
		return this._queueCommand(command).timeout(2000);
	}

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

	private handlePacket = (packet: Packet.Packet) => {

		/* Emitting packet for others to use */
		this.emit('packet', packet);

		if(this.options.debug){
			if(packet.type === PacketID.SendInsteonMessage){
				const p = packet as Packet.SendInsteonMessage;
				console.log(`[→][${toAddressString(p.to)}][${(p.flags & 0x10) == 16 ? 'E' : 'S'}][${p.Type}]: ${toHex(p.cmd1)} ${toHex(p.cmd2)} ${p.extendedData? p.extendedData.map(toHex) : ''}`);
			}
			else if(packet.type === PacketID.ExtendedMessageReceived || packet.type === PacketID.StandardMessageReceived){
				const p = packet as Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved;
				console.log(`[←][${toAddressString(p.from)}][${p.Flags.extended ? 'E' : 'S'}][${p.Flags.Subtype}]: ${toHex(p.cmd1)} ${toHex(p.cmd2)} ${p.Flags.extended ? p.extendedData.map(toHex) : ''}`);
			}
			else{
				console.log(`[⇄][${packet.Type}]: ${packet.cmd1? toHex(packet.cmd1) : ''} ${packet.cmd2? toHex(packet.cmd2) : ''}`);
			}
		}

		/* Checking if packet is from a device */
		if(packet.type === PacketID.StandardMessageReceived || packet.type === PacketID.ExtendedMessageReceived){
			let p = packet as Packet.StandardMessageRecieved;

			const deviceID = toAddressString(p.from);

			this.emit(['p', p.type.toString(16), p.Flags.subtype.toString(16), deviceID], p);
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

	public static getDeviceInfo = (cat: Byte, subcat: Byte): Device | undefined =>
		deviceDB.devices.find(d => Number(d.cat) === cat && Number(d.subcat) === subcat);

	//#endregion

	//#region Device Methods

	/* Send an insteon command from the modem to a device to find out what it is */
	public queryDeviceInfo = (deviceID: Byte[], options?: DeviceOptions) => new Bluebird<Device>((resolve, reject) => {
		// We got cached device info, no need to query the device.
		if(options?.cache){
			// console.log("Cache used",options);
			resolve(options?.cache.info);
			return;
		}
		// console.log("Cache not used, querying for device info");
		
		// Catching broadcast message
		this.once(
			['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.BroadcastMessage.toString(16), toAddressString(deviceID)],
			(data: Packet.StandardMessageRecieved) =>
				resolve(PowerLincModem.getDeviceInfo(data.to[0],data.to[1]))
		);

		this.sendStandardCommand(deviceID, 0x10, 0x00);
	}).timeout(2000);
	

	/**
	 * Factory method for creating a device instance of the correct type
	 * e.g. user inputs aa.bb.cc, modem queries the device and finds out it's a dimmer
	 * thus returns an instance of a DimmableLightingDevice
	 **/
	public async getDeviceInstance(deviceID: Byte[], options?: DeviceOptions){
		let info = await this.queryDeviceInfo(deviceID, options);

		switch(Number(info.cat)){
			case 0x01:
				switch(Number(info.subcat)){
					case 0x1C: return new KeypadDimmer(deviceID, this, options);
					default: return new DimmableLightingDevice(deviceID, this, options);
				}

			case 0x02: return new SwitchedLightingDevice(deviceID, this, options);

			case 0x07:
				switch(Number(info.subcat)){
					case 0x00: return new IOLinc(deviceID, this, options);
					default: return new SensorActuatorDevice(deviceID, this, options);
				}

			case 0x10:
				switch(Number(info.subcat)){
					case 0x01:
					case 0x03:
					case 0x04:
					case 0x05: return new MotionSensor(deviceID, this, options);

					case 0x02:
					case 0x06:
					case 0x07:
					case 0x09:
					case 0x11:
					case 0x14:
					case 0x015: return new OpenCloseSensor(deviceID, this, options);

					case 0x08: return new LeakSensor(deviceID, this, options);

					default: return new SecurityDevice(deviceID, this, options);
				}

			default: return new InsteonDevice(deviceID, this, options);
		}
	}

	//#endregion

	//#region Management Methods

	public async linkDevice(address: Byte[], group: Byte = 0x01){

		// Start PLM linking
		let mStarted = await this.startLinking(AllLinkRecordType.Controller, group);

		// Checking that we started linking
		if(!mStarted)
			throw Error('Could not start modem linking');

		// Waiting for modem to get ready for a network message
		await delay(2000);

		// Start Device linking
		let started = await InsteonDevice.enterLinking(this, address);

		// Checking we started device linking
		if(!started)
			throw Error('Could not start device linking');
	}

	public async unlinkDevice(address: Byte[], group: Byte = 0x01){

		// Remove record from Device
		let started = await InsteonDevice.enterUnlinking(this, address, group);

		// Checking we started device linking
		if(!started)
			throw Error('Could not start device unlinking');

		// Waiting for modem to get ready for a network message
		await delay(2000);

		// Remove record from PLM
		let mStarted = await this.startLinking(AllLinkRecordType.Responder, group);

			// Checking that we started linking
		if(!mStarted)
			throw Error('Could not start modem unlinking');
	}

	public listLinkedDevices(){

		return this.links.reduce((arr: any[], l, i) => {

			let stringID = toAddressString(l.device);

			if(!arr.includes(stringID))
				arr.push(l.device);

			return arr;

		}, []);
	}

	//#endregion
};

//#endregion
