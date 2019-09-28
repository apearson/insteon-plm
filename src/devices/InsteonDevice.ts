/* Libraries */
import {EventEmitter} from 'events';
import { AsyncQueue, queue, AsyncResultCallback } from 'async';
import PLM, { QueueTaskData } from '../main';

/* Types */
import { Byte, PacketID, Packets } from 'insteon-packet-parser';

/* Interface */
interface DeviceCommandTask {
	cmd1: Byte;
	cmd2: Byte;
	flags?: Byte;
	userData?: Byte[];
}

/* Abstract class for Insteon Devices */
export default class InsteonDevice extends EventEmitter{

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
		/* Constucting EventEmitter class */
		super();

		/* Saving serialport */
		this.modem = modem;

		/* Setting up info */
		this.address = deviceID;
		this.addressString = deviceID.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');

		/* Setting up request queue */
		this.requestQueue = queue(this.processQueue, 1);
	}

	//#endregion

	//#region Utility Method

	/* Inital Length check and comparing every index together */
	protected areAddressesSame = (a: number[], b: number[]) => 
		(a.length === b.length && a.every((v, i)=> v === b[i]));

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

	//#endregion

	//#region Insteon Methods

	public getEngineVersion = () => new Promise<Byte>((resolve, reject) => {

		// Setting up command
		const cmd1 = 0x0D;
		const cmd2 = 0x00;

		/* Sending command */
		this.requestQueue.push({cmd1, cmd2}, (err: Error, data: Packets.StandardMessageRecieved) => {
			if(err) reject(err)
			else resolve(data.cmd2);
		});	

	});

	//#endregion

	//#region Linking

	public startRemoteLinking = () => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {

		// Setting up command
		const cmd1 = 0x09;
		const cmd2 = 0x01;
		const userData: Byte[] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		userData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, userData));


		/* Sending command */
		this.requestQueue.push({cmd1, cmd2, userData}, (err: Error, data: Packets.StandardMessageRecieved) => {
			if(err) reject(err)
			else resolve(data);
		});	
	});

	public stopRemoteLinking = () => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {

		// Setting up command
		const cmd1 = 0x08;
		const cmd2 = 0x00;

		this.requestQueue.push({cmd1, cmd2}, (err: Error, data: Packets.StandardMessageRecieved) => {
			if(err) reject(err)
			else resolve(data);
		});	
	});

	//#endregion

	//#region Queue Functions

	private processQueue = async (task: DeviceCommandTask, callback: AsyncResultCallback<Packets.Packet>) => {

		/* Determining packet data */
		const isExtended = !!task.userData;
		const flag = task.flags ? task.flags 
							 : isExtended ? 0x1F
							 : 0x0F
		const packetType = isExtended ? PacketID.ExtendedMessageReceived.toString(16)
		                              : PacketID.StandardMessageReceived.toString(16);

		// Once we hear an echo (same command back) the modem is ready for another command
		this.modem.once(['p', packetType, '**'], d => callback(null, d) );

		// Attempting to write command to modem
		const isSuccessful = isExtended ? await this.modem.sendExtendedCommand(this.address, flag, task.cmd1, task.cmd2, task.userData)
																		: await this.modem.sendStandardCommand(this.address, flag, task.cmd1, task.cmd2);

		if(!isSuccessful)
			callback(Error('Could not execute packet'));
	}

	//#endregion
}