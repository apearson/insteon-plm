/* Libraries */
import {EventEmitter} from 'events';
import PLM from '../main';

/* Types */
import { Byte, PacketID, Packets } from 'insteon-packet-parser';

/* Interface */

/* Abstract class for Insteon Devices */
export default abstract class InsteonDevice extends EventEmitter{
	/* Class Info */
	protected address: Byte[];
	protected addressString: string;

	/* Inernal Variaables */
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

	/* Utility Methods */
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

	public static startRemoteLinking = (plm: PLM, deviceID: Byte[]) => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {

		// Setting up command
		const id = deviceID.map(num => num.toString(16).toUpperCase()).join('.');
		const cmd1 = 0x09;
		const cmd2 = 0x01;
		const userData: Byte[] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

		plm.once(
			['p', PacketID.StandardMessageReceived.toString(16), '*', id], 
			(data: Packets.StandardMessageRecieved)=> resolve(data)
		);
		
		// Calulating check sum
		const checksum = InsteonDevice.calulateChecksum(cmd1, cmd2, userData);

		// Starting linking 
		plm.sendExtendedCommand(deviceID, 0x1F, cmd1, cmd2, [...userData, checksum]);
	});

	public static stopRemoteLinking = (plm: PLM, deviceID: Byte[]) => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {
		console.log('Stopping remote linking');

		// Setting up command
		const id = deviceID.map(num => num.toString(16).toUpperCase()).join('.');
		const cmd1 = 0x08;
		const cmd2 = 0x00;

		plm.once(
			['p', PacketID.StandardMessageReceived.toString(16), '*', id], 
			(data: Packets.StandardMessageRecieved)=> resolve(data)
		);
		
		// Starting linking 
		plm.sendStandardCommand(deviceID, 0x0F, cmd1, cmd2);
	});
}