/* Libraries */
import {EventEmitter} from 'events';
import * as SerialPort from 'serialport';
import {InsteonParser, PacketID, Packets} from '../../insteon-packet-parser/src/main';

/* Library Exports */
export {Packets, PacketID};

/* Types */
import {Byte} from './typings/typings';

/* Devices */
export {InsteonDevice} from './devices/InsteonDevice';
export {KeypadLincRelay} from './devices/KeypadLincRelay';
export {OutletLinc} from './devices/OutletLinc';
export {SwitchLincDimmer} from './devices/SwitchLincDimmer';
export {SwitchLincRelay} from './devices/SwitchLincRelay';

/* Request Handlers */
import {handlers} from './handlers';

/* Interface */
export interface ModemRequest{
	resolve: (data: any)=> void;
	reject: ()=> void;
	type: PacketID;
	command: Buffer;
	retries: number;
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

/* PLM Class */
export class PLM extends EventEmitter{
	/* Internal Variables */
	private _requestQueue: ModemRequest[] = [];
	private _busy: boolean = false;
	private _commandTimeout: number = 1000;

	/* Linking */
	private _linking: boolean = false;
	private _links: Packets.AllLinkRecordResponse[][] = [];

	/* Internal Data holder */
	private _info:ModemInfo = {
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
	private _led:boolean = false;

	/* Serial Port Options */
	private _port: SerialPort;
	private _parser: InsteonParser;

	constructor(portPath: string){
		/* Constructing super class */
		super();

		/* Opening serial port */
		this._port = new SerialPort(portPath, {
			lock: false,
			baudRate: 19200,
			dataBits: 8,
			stopBits: 1,
			parity: 'none'
		});

		/* Creating new parser */
		this._parser = new InsteonParser({debug: false, objectMode: true});

		/* Porting serial port to parser */
		this._port.pipe(this._parser);

		/* Waiting for serial port to open */
		this._port.on('open', async () => {
			/* Emitting connected and syncing */
			this.emit('connected');

			/* Inital Sync of info */
			this._info   = await this.syncInfo();
			this._config = await this.syncConfig();
			await this.syncAllLinks();

			/* Emitting ready */
			this.emit('ready');
		});

		/* On Packet */
		this._parser.on('data', (packet: Packets.Packet)=>{
			/* Emitting packet for others to use */
			this.emit('packet', packet);

			this._handleResponse(packet);
		});
	}

	/* Modem Info */
	syncInfo(): Promise<ModemInfo>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);
			commandBuffer.writeUInt8(0x60, 1);

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x60,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	syncConfig(): Promise<ModemConfig>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);
			commandBuffer.writeUInt8(0x73, 1);

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x73,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	syncAllLinks(): Promise<Packets.AllLinkRecordResponse[][]>{
		return new Promise(async (resolve, reject)=>{
			/* Creating an array of 255 groups filled with empty arrays */
			let groups = [...Array(255).keys()].map(i => Array(0));

			/* Getting first record */
			let record = await this.getFirstAllLinkRecord();

			/* Checking if first record exists */
			if(typeof record != 'boolean'){
				groups[record.allLinkGroup].push(record);
			}

			/* While there are more records get them */
			while(typeof record != 'boolean'){
				record = await this.getNextAllLinkRecord();

				/* Checking if retrieved record exists */
				if(typeof record != 'boolean'){
					groups[record.allLinkGroup].push(record);
				}
			}

			/* Saving all link database */
			this._links = groups;

			resolve(this._links);
		});
	}

	/* Modem Config */
	get info(){
		return this._info;
	}
	get config(){
		return this._config;
	}
	get links(){
		return this._links;
	}

	/* Modem LED */
	get led(){
		return this._led;
	}
	setLed(state: boolean): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Determining command */
			let command: PacketID = state ? 0x6D:0x6E;

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);
			commandBuffer.writeUInt8(command, 1);

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: command,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}

	/* Modem Control */
	setConfig(autoLinking: boolean, monitorMode: boolean, autoLED: boolean, deadman: boolean): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Configuration byte */
			let flagByte = 0x00;

			if(!autoLinking) flagByte |= 0x80;  //1000 0000
			if(monitorMode)  flagByte |= 0x40;  //0100 0000
			if(!autoLED)     flagByte |= 0x20;  //0010 0000
			if(!deadman)     flagByte |= 0x10;  //0001 0000

			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(3);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);     //PLM Command
			commandBuffer.writeUInt8(0x6B, 1);     //Set IM Configuration
			commandBuffer.writeUInt8(flagByte, 2); //IM Configuration Flags

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x6B,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	setCategory(cat: Byte, subcat: Byte): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(5);

			/* Creating command */
			commandBuffer.writeUInt8(0x02,   0); //PLM Command
			commandBuffer.writeUInt8(0x66,   1); //Set Cat and Subcat
			commandBuffer.writeUInt8(cat,    2); //Cat
			commandBuffer.writeUInt8(subcat, 3); //Subcat
			commandBuffer.writeUInt8(0xff,   4); //Legacy Firmware version

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x66,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	sleep(): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(4);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0); //PLM Command
			commandBuffer.writeUInt8(0x72, 1); //RF Sleep Byte
			commandBuffer.writeUInt8(0x00, 2); //Command 1 (Not Used)
			commandBuffer.writeUInt8(0x00, 3); //Command 2 (Not Used)

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x72,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	wake(): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(1);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0); //PLM Command

			/* Creating Request */
			const request: ModemRequest = {
				resolve: ()=> {},
				reject: reject,
				type: 0x72,
				command: commandBuffer,
				retries: 3,
			};

			/* Responding after wake up */
			setTimeout(()=>{
				this._busy = false;

				resolve(true);
			}, 40);

			/* Sending command */
			this.execute(request);
		});
	}
	close(){
		return this._port.close();
	}

	/* All Link Command */
	startLinking(type: Byte, group: Byte): Promise<void>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(4);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0); //PLM Command
			commandBuffer.writeUInt8(0x64, 1); //Start Linking Byte
			commandBuffer.writeUInt8(type, 2); //Link Code
			commandBuffer.writeUInt8(group, 3); //Group

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x64,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	cancelLinking(): Promise<void>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0); //PLM Command
			commandBuffer.writeUInt8(0x65, 1); //Start Linking Byte

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x65,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	getFirstAllLinkRecord(): Promise<Packets.AllLinkRecordResponse | boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);
			commandBuffer.writeUInt8(0x69, 1);

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x57,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	getNextAllLinkRecord(): Promise<Packets.AllLinkRecordResponse | boolean>{
		return new Promise((resolve, reject)=>{
			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(2);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);
			commandBuffer.writeUInt8(0x6A, 1);

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x57,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}

	/* Send commands */
	sendStandardCommand(deviceID: string | Byte[], flags: Byte, cmd1: Byte, cmd2: Byte): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Parsing out device ID */
			if(typeof deviceID === 'string' ){
				deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
			}

			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(8);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);  //PLM Command
			commandBuffer.writeUInt8(0x62, 1);  //Standard Length Message
			commandBuffer.writeUInt8(deviceID[0], 2); //Device High Address Byte
			commandBuffer.writeUInt8(deviceID[1], 3); //Device Middle Address Byte
			commandBuffer.writeUInt8(deviceID[2], 4); //Device Low Address Byte
			commandBuffer.writeUInt8(flags || 0x0F, 5); //Message Flag Byte
			commandBuffer.writeUInt8(cmd1 || 0x00, 6);  //Command Byte 1
			commandBuffer.writeUInt8(cmd2 || 0x00, 7);  //Command Byte 2

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x62,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}
	sendExtendedCommand(deviceID: string | Byte[], flags: Byte, cmd1: Byte, cmd2: Byte, userData: Byte[]): Promise<boolean>{
		return new Promise((resolve, reject)=>{
			/* Parsing out device ID */
			if(typeof deviceID === 'string' ){
				deviceID = deviceID.split('.').map((byte)=> parseInt(byte, 16) as Byte);
			}

			/* Allocating command buffer */
			const commandBuffer = Buffer.alloc(22);

			/* Creating command */
			commandBuffer.writeUInt8(0x02, 0);  //PLM Command
			commandBuffer.writeUInt8(0x62, 1);  //Standard Length Message
			commandBuffer.writeUInt8(deviceID[0], 2); //Device High Address Byte
			commandBuffer.writeUInt8(deviceID[1], 3); //Device Middle Address Byte
			commandBuffer.writeUInt8(deviceID[2], 4); //Device Low Address Byte
			commandBuffer.writeUInt8(flags || 0x0F, 5); //Message Flag Byte
			commandBuffer.writeUInt8(cmd1 || 0x00, 6);  //Command Byte 1
			commandBuffer.writeUInt8(cmd2 || 0x00, 7);  //Command Byte 2
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

			/* Creating Request */
			const request: ModemRequest = {
				resolve: resolve,
				reject: reject,
				type: 0x62,
				command: commandBuffer,
				retries: 3,
			};

			/* Sending command */
			this.execute(request);
		});
	}

	/* Internal command functions */
	execute(request: ModemRequest){
		/* Setting indiviual device queue to ready */
		this._busy == false;

		/* Pushing request onto modem queue */
		this._requestQueue.push(request);

		/* Flushing queue */
		this._flush();
	}
	async _flush(){
		/* Checking we have a request and a command is not in progress */
		if(this._requestQueue[0] && !this._busy){
			/* Marking command in flight */
			this._busy = true;

			try{
				/* Writing command to modem */
				await this._port.write(this._requestQueue[0].command);
			}
			catch(error){
				console.error(error);
			}
		}
	}

	/* Response Functions */
	async _handleResponse(packet: Packets.Packet){
		/* Determining Request and Response */
		let requestHandled = await handlers[packet.id](this._requestQueue, packet, this) as boolean;

		/* Finishing request */
		if(requestHandled){
			/* Marking we have an echo */
			this._busy = false;
		}

		/* Flushing next command */
		this._flush();
	}
};
